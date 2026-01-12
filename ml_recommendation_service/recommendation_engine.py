from __future__ import annotations

from typing import Any, Dict, List, Tuple
from collections import defaultdict
import os
from pathlib import Path

from .config import TOP_K_COURSES, TOP_K_SPONSORS, CONTENT_WEIGHT, COLLAB_WEIGHT, DIVERSITY_STRENGTH, SEMANTIC_WEIGHT, USE_ANN, ANN_N_NEIGHBORS, ANN_CANDIDATES, BANDIT_EPSILON, BANDIT_EXPLORE_K
from .models import ContentBasedRecommender, CollaborativeRecommender, SponsorMatcher, SemanticRecommender, PeopleRecommender, ANNRetriever


class RecommendationEngine:
    def __init__(self, db_connector):
        self.db = db_connector
        self._content = None
        self._students = None
        self._sponsors = None
        self.content_model = ContentBasedRecommender()
        self.collab_model = CollaborativeRecommender()
        self.sponsor_model = SponsorMatcher()
        self.semantic_model = SemanticRecommender()
        self.people_model = PeopleRecommender()
        self.ann = ANNRetriever(n_neighbors=ANN_N_NEIGHBORS) if USE_ANN else None
        # where to store persisted models
        self._store_dir = Path(os.getenv("MODEL_STORE_DIR", Path(__file__).parent / "models_store"))
        self._store_dir.mkdir(parents=True, exist_ok=True)

    def train_models(self):
        # Load data from DB
        self._content = self.db.get_all_content() or []
        self._students = self.db.get_all_students() or []
        self._sponsors = self.db.get_all_sponsors() or []

        # Try to load persisted models first
        loaded = self._load_models()

        # If loaded, verify content IDs match current content; otherwise force retrain
        def _normalized_course_ids() -> List[str]:
            ids: List[str] = []
            for i, c in enumerate(self._content or []):
                cid = c.get("course_id")
                if cid in (None, ""):
                    cid = i
                ids.append(str(cid))
            return ids

        if loaded:
            try:
                current_ids = _normalized_course_ids()
                stored_ids = getattr(self.content_model, "_course_ids", []) or []
                if stored_ids != current_ids:
                    # Invalidate loaded state to avoid stale models
                    loaded = False
                    self.content_model._vectorizer = None
                    self.content_model._content_matrix = None
                    self.content_model._course_ids = []
            except Exception:
                # If any issue, prefer retrain
                loaded = False

        # Fit models if not loaded
        if not loaded:
            if self._content:
                self.content_model.fit(self._content)
            if self._students:
                self.collab_model.fit(self._students)
            if self._content:
                self.semantic_model.fit(self._content)
            self._save_models()
        if self._sponsors:
            self.sponsor_model.fit(self._sponsors)
        # Fit people model (teachers may be absent; people_model handles None)
        self.people_model.fit(self._students or [], [])

        # Fit ANN retriever using the same TF-IDF course matrix if available
        try:
            if USE_ANN and self.ann is not None and getattr(self.content_model, "_content_matrix", None) is not None:
                matrix = getattr(self.content_model, "_content_matrix")
                course_ids = getattr(self.content_model, "_course_ids", [])
                if matrix is not None and course_ids:
                    self.ann.fit(matrix, [str(c) for c in course_ids])
        except Exception:
            # ANN is optional; ignore failures
            pass

    @staticmethod
    def _diversify(ranked: List[Tuple[str, float]], content_index: Dict[str, Dict[str, Any]]) -> List[Tuple[str, float]]:
        if not ranked:
            return ranked
        seen_tags: set = set()
        diversified: List[Tuple[str, float]] = []
        for cid, score in ranked:
            course = content_index.get(cid, {})
            tags = course.get("tags")
            if isinstance(tags, list):
                penalty = DIVERSITY_STRENGTH * len(seen_tags.intersection(tags))
                seen_tags.update(tags)
            else:
                penalty = 0.0
            diversified.append((cid, max(0.0, score - penalty)))
        diversified.sort(key=lambda x: x[1], reverse=True)
        return diversified

    def _rank_courses(self, student: Dict[str, Any]) -> List[Tuple[str, float]]:
        # Pre-index content
        content_idx = {str(c.get("course_id")): c for c in (self._content or [])}

        # Optional ANN candidates (first-stage retrieval)
        ann_candidates: List[str] = []
        if USE_ANN and self.ann is not None:
            try:
                # reuse content-based student vector via private helper if present
                if hasattr(self.content_model, "_student_interest_text") and hasattr(self.content_model, "_vectorizer"):
                    # Build student vector using the same vectorizer
                    text = self.content_model._student_interest_text(student)
                    vec = self.content_model._vectorizer.transform([text]) if self.content_model._vectorizer else None
                else:
                    vec = None
                if vec is not None:
                    ann_candidates = self.ann.retrieve(vec, top_k=ANN_CANDIDATES)
            except Exception:
                ann_candidates = []

        # Get per-model scores
        content_scores = self.content_model.recommend(student, top_k=TOP_K_COURSES * 3)
        collab_scores = self.collab_model.recommend(student, top_k=TOP_K_COURSES * 3)
        semantic_scores = self.semantic_model.recommend(student, top_k=TOP_K_COURSES * 3)

        weights = {
            "content": CONTENT_WEIGHT,
            "collab": COLLAB_WEIGHT,
            "semantic": SEMANTIC_WEIGHT,
        }

        combined: Dict[str, float] = defaultdict(float)
        for cid, s in content_scores:
            combined[cid] += weights["content"] * float(s)
        for cid, s in collab_scores:
            combined[cid] += weights["collab"] * float(s)
        for cid, s in semantic_scores:
            combined[cid] += weights["semantic"] * float(s)

        # If ANN candidates exist, filter combined scores to that candidate pool unioned with existing ids
        if ann_candidates:
            candidate_set = set(ann_candidates) | set(combined.keys())
            combined = {cid: combined.get(cid, 0.0) for cid in candidate_set}

        ranked = sorted(combined.items(), key=lambda x: x[1], reverse=True)
        ranked = self._diversify(ranked, content_idx)

        # Optional epsilon-greedy exploration: swap a few items with random remaining candidates
        if BANDIT_EPSILON > 0.0 and len(ranked) > TOP_K_COURSES:
            try:
                import random
                if random.random() < BANDIT_EPSILON:
                    top = ranked[:TOP_K_COURSES]
                    rest = ranked[TOP_K_COURSES:]
                    k = min(BANDIT_EXPLORE_K, len(rest))
                    explore = random.sample(rest, k) if k > 0 else []
                    # Replace last k of top with explore
                    top = top[: max(0, TOP_K_COURSES - k)] + explore
                    ranked = top
            except Exception:
                pass
        else:
            ranked = ranked[:TOP_K_COURSES]
        return ranked

    def _rank_sponsors(self, student: Dict[str, Any]) -> List[Tuple[str, float]]:
        return self.sponsor_model.match(student, top_k=TOP_K_SPONSORS)

    def recommend_for_student(self, student_id: str) -> Dict[str, Any]:
        student = self.db.get_student_profile(str(student_id))
        if not student:
            return {"student_id": str(student_id), "courses": [], "sponsors": []}

        courses = self._rank_courses(student)
        sponsors = self._rank_sponsors(student)

        # Enrich with metadata (titles, names) for convenience
        content_idx = {str(c.get("course_id")): c for c in (self._content or [])}
        sponsor_idx = {str(s.get("sponsor_id")): s for s in (self._sponsors or [])}

        course_payload = [
            {
                "course_id": cid,
                "score": float(score),
                "title": content_idx.get(cid, {}).get("title"),
                "tags": content_idx.get(cid, {}).get("tags"),
            }
            for cid, score in courses
        ]

        sponsor_payload = [
            {
                "sponsor_id": sid,
                "score": float(score),
                "name": sponsor_idx.get(sid, {}).get("name"),
            }
            for sid, score in sponsors
        ]

        # people suggestions
        similar_students = [
            {"student_id": sid, "score": float(score)} for sid, score in self.people_model.similar_students(student)
        ]
        matching_teachers = [
            {"teacher_id": tid, "score": float(score)} for tid, score in self.people_model.matching_teachers(student)
        ]

        result = {
            "student_id": str(student.get("student_id", student_id)),
            "courses": course_payload,
            "sponsors": sponsor_payload,
            "similar_students": similar_students,
            "matching_teachers": matching_teachers,
        }
        return result

    def batch_recommendations(self) -> None:
        if self._students is None:
            self._students = self.db.get_all_students() or []
        for s in self._students:
            sid = str(s.get("student_id"))
            if not sid:
                continue
            rec = self.recommend_for_student(sid)
            self.db.save_recommendations(sid, rec)

    # ---- persistence ----
    def _load_models(self) -> bool:
        try:
            from joblib import load
        except Exception:
            return False
        content_path = self._store_dir / "content_model.joblib"
        collab_path = self._store_dir / "collab_model.joblib"
        if content_path.exists():
            try:
                state = load(content_path)
                # restore content model internals
                self.content_model._vectorizer = state.get("vectorizer")
                self.content_model._content_matrix = state.get("content_matrix")
                self.content_model._course_ids = state.get("course_ids", [])
            except Exception:
                pass
        if collab_path.exists():
            try:
                state = load(collab_path)
                self.collab_model._user_items = state.get("user_items", {})
                self.collab_model._item_popularity = state.get("item_popularity", {})
            except Exception:
                pass
        # consider loaded if both have essential state
        vec_ok = getattr(self.content_model, "_vectorizer", None) is not None
        mat_ok = getattr(self.content_model, "_content_matrix", None) is not None
        ids_ok = bool(getattr(self.content_model, "_course_ids", []))
        return bool(vec_ok and mat_ok and ids_ok)

    def _save_models(self) -> None:
        try:
            from joblib import dump
        except Exception:
            return
        content_state = {
            "vectorizer": getattr(self.content_model, "_vectorizer", None),
            "content_matrix": getattr(self.content_model, "_content_matrix", None),
            "course_ids": getattr(self.content_model, "_course_ids", []),
        }
        collab_state = {
            "user_items": getattr(self.collab_model, "_user_items", {}),
            "item_popularity": getattr(self.collab_model, "_item_popularity", {}),
        }
        try:
            dump(content_state, self._store_dir / "content_model.joblib")
            dump(collab_state, self._store_dir / "collab_model.joblib")
        except Exception:
            # ignore persistence failures
            pass
