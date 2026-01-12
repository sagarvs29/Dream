from __future__ import annotations

from typing import Any, Dict, List, Tuple


class ContentBasedRecommender:
    """TF-IDF over course tags/title/description matched to student interests.

    Uses cosine similarity. Heavy imports are lazy inside methods.
    """

    def __init__(self):
        self._vectorizer = None
        self._content_matrix = None
        self._course_ids: List[str] = []

    @staticmethod
    def _normalize_tags(tags: Any) -> str:
        if tags is None:
            return ""
        if isinstance(tags, list):
            return " ".join([str(t) for t in tags])
        return str(tags)

    @staticmethod
    def _student_interest_text(student: Dict[str, Any]) -> str:
        parts = []
        interests = student.get("interests")
        if isinstance(interests, list):
            parts.extend([str(i) for i in interests])
        elif interests:
            parts.append(str(interests))
        profile = student.get("profile", {}) or {}
        for k in ("department", "major", "year", "gpa"):
            v = profile.get(k)
            if v is not None and v != "":
                parts.append(str(v))
        return " ".join(parts)

    @staticmethod
    def _course_text(course: Dict[str, Any]) -> str:
        title = course.get("title", "")
        desc = course.get("description", "")
        tags = ContentBasedRecommender._normalize_tags(course.get("tags"))
        return f"{title} {desc} {tags}".strip()

    def fit(self, content: List[Dict[str, Any]]):
        from sklearn.feature_extraction.text import TfidfVectorizer

        texts = [self._course_text(c) for c in content]
        ids: List[str] = []
        for i, c in enumerate(content):
            cid = c.get("course_id")
            if cid in (None, ""):
                cid = i
            ids.append(str(cid))
        self._course_ids = ids
        self._vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
        self._content_matrix = self._vectorizer.fit_transform(texts)

    def recommend(self, student: Dict[str, Any], top_k: int = 10) -> List[Tuple[str, float]]:
        if self._vectorizer is None or self._content_matrix is None:
            return []

        from sklearn.metrics.pairwise import cosine_similarity

        query_text = self._student_interest_text(student)
        if not query_text:
            return []
        q_vec = self._vectorizer.transform([query_text])
        sims = cosine_similarity(q_vec, self._content_matrix)[0]
        max_sim = float(sims.max()) if sims.size > 0 else 1.0
        sims = sims / (max_sim or 1.0)
        ranked = sorted(zip(self._course_ids, sims), key=lambda x: x[1], reverse=True)
        return ranked[:top_k]
