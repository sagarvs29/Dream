from __future__ import annotations

from typing import Any, Dict, List, Optional
import os
import json

import os

# Apply variant-based overrides before importing engine/config
_VARIANT = os.getenv("VARIANT")
if _VARIANT == "B":
    # Example B variant: stronger semantic, enable ANN, small exploration
    os.environ.setdefault("SEMANTIC_WEIGHT", "0.15")
    os.environ.setdefault("USE_ANN", "true")
    os.environ.setdefault("BANDIT_EPSILON", "0.05")
elif _VARIANT == "C":
    # Example C variant: content-heavy, no exploration
    os.environ.setdefault("CONTENT_WEIGHT", "0.8")
    os.environ.setdefault("COLLAB_WEIGHT", "0.2")
    os.environ.setdefault("SEMANTIC_WEIGHT", "0.0")
    os.environ.setdefault("BANDIT_EPSILON", "0.0")

from .recommendation_engine import RecommendationEngine
from .offline_connector import OfflineConnector
from .mongo_connector import MongoDBConnector


class InMemoryConnector:
    """A minimal in-memory connector with the same API as our DB connectors.

    Useful for integrating with apps that already hold dummy data in memory.
    """

    def __init__(
        self,
        students: List[Dict[str, Any]],
        content: List[Dict[str, Any]],
        sponsors: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self._students = [
            {**s, "student_id": str(s.get("student_id"))} for s in (students or [])
        ]
        self._content = [
            {**c, "course_id": str(c.get("course_id"))} for c in (content or [])
        ]
        self._sponsors = [
            {**sp, "sponsor_id": str(sp.get("sponsor_id"))} for sp in (sponsors or [])
        ]
        self._saved: Dict[str, Dict[str, Any]] = {}

    # API compatible getters
    def get_all_students(self) -> List[Dict[str, Any]]:
        return list(self._students)

    def get_all_content(self) -> List[Dict[str, Any]]:
        return list(self._content)

    def get_all_sponsors(self) -> List[Dict[str, Any]]:
        return list(self._sponsors)

    def get_student_profile(self, student_id: str) -> Optional[Dict[str, Any]]:
        for s in self._students:
            if s.get("student_id") == str(student_id):
                return s
        return None

    def save_recommendations(
        self,
        student_id: str,
        recommendations: Dict[str, Any],
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        self._saved[str(student_id)] = recommendations


class RecommenderService:
    """Thin adapter to integrate with different data sources easily.

    Modes:
      - auto: prefer precomputed offline_recommendations.jsonl if present; else offline files; else Mongo
      - precomputed: serve recommendations from offline_recommendations.jsonl
      - offline: read Student_rec/Content_rec/Sponsers_rec (XLSX/CSV)
      - mongo: connect to MongoDB using env or provided URI/DB
      - inmemory: use provided lists (students, content, sponsors)
    """

    def __init__(
        self,
        mode: str = "auto",
        *,
        # Precomputed
        precomputed_path: str = "offline_recommendations.jsonl",
        use_precomputed: bool = True,
        # Offline file paths
        students_path: str = "Student_rec.xlsx",
        content_path: str = "Content_rec.xlsx",
        sponsors_path: str = "Sponsers_rec.xlsx",
        # Mongo
        mongo_uri: Optional[str] = None,
        db_name: Optional[str] = None,
        # In-memory data
        students: Optional[List[Dict[str, Any]]] = None,
        content: Optional[List[Dict[str, Any]]] = None,
        sponsors: Optional[List[Dict[str, Any]]] = None,
    ) -> None:
        self._engine: Optional[RecommendationEngine] = None
        self._trained: bool = False
        self._precomputed: Dict[str, Dict[str, Any]] = {}
        self._connector = None
        self._cache: Dict[str, Dict[str, Any]] = {}

        # Resolve mode
        resolved_mode = mode
        if mode == "auto":
            if use_precomputed and os.path.exists(precomputed_path):
                resolved_mode = "precomputed"
            elif students is not None and content is not None:
                resolved_mode = "inmemory"
            elif os.path.exists(students_path) and os.path.exists(content_path):
                resolved_mode = "offline"
            else:
                resolved_mode = "mongo"

        self._mode = resolved_mode

        if resolved_mode == "precomputed":
            self._precomputed = self._load_precomputed(precomputed_path)
        elif resolved_mode == "inmemory":
            self._connector = InMemoryConnector(students or [], content or [], sponsors or [])
            self._engine = RecommendationEngine(self._connector)
        elif resolved_mode == "offline":
            self._connector = OfflineConnector(
                students_path=students_path,
                content_path=content_path,
                sponsors_path=sponsors_path,
            )
            self._engine = RecommendationEngine(self._connector)
        elif resolved_mode == "mongo":
            uri = mongo_uri or os.getenv("MONGO_URI")
            db = db_name or os.getenv("DB_NAME")
            self._connector = MongoDBConnector(uri=uri, db_name=db)
            self._engine = RecommendationEngine(self._connector)
        else:
            raise ValueError(f"Unknown mode: {resolved_mode}")

    # ---- public API ----
    def get_recommendations(self, student_id: str) -> Dict[str, Any]:
        # Serve from in-process cache if present
        sid = str(student_id)
        if sid in self._cache:
            return self._cache[sid]
        if self._mode == "precomputed":
            res = self._precomputed.get(str(student_id), {
                "student_id": str(student_id),
                "courses": [],
                "sponsors": [],
                "similar_students": [],
                "matching_teachers": [],
            })
            self._cache[sid] = res
            return res
        # Engine path
        assert self._engine is not None
        self._ensure_trained()
        res = self._engine.recommend_for_student(str(student_id))
        self._cache[sid] = res
        return res

    def batch_recommendations(self) -> None:
        if self._mode == "precomputed":
            return None
        assert self._engine is not None
        self._ensure_trained()
        self._engine.batch_recommendations()

    def available_student_ids(self) -> List[str]:
        if self._mode == "precomputed":
            return list(self._precomputed.keys())
        if self._connector is None:
            return []
        try:
            return [str(s.get("student_id")) for s in self._connector.get_all_students()]  # type: ignore[attr-defined]
        except Exception:
            return []

    def is_ready(self) -> bool:
        if self._mode == "precomputed":
            return len(self._precomputed) > 0
        if not self._connector:
            return False
        try:
            has_students = len(self._connector.get_all_students()) > 0  # type: ignore[attr-defined]
            has_content = len(self._connector.get_all_content()) > 0  # type: ignore[attr-defined]
            return has_students and has_content
        except Exception:
            return False

    def clear_cache(self) -> None:
        self._cache.clear()

    # ---- internals ----
    def _ensure_trained(self) -> None:
        if self._trained:
            return
        # Train once lazily
        if self._engine:
            self._engine.train_models()
            self._trained = True

    @staticmethod
    def _load_precomputed(path: str) -> Dict[str, Dict[str, Any]]:
        data: Dict[str, Dict[str, Any]] = {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    obj = json.loads(line)
                    sid = str(obj.get("student_id"))
                    if sid:
                        data[sid] = obj
        except Exception:
            # If anything goes wrong, return empty map
            return {}
        return data
