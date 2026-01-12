from __future__ import annotations

from typing import Any, Dict, List, Tuple


class SemanticRecommender:
    """Optional sentence-transformers based semantic recommender.

    If sentence_transformers or torch are unavailable, this model will return empty recommendations.
    """

    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self._model_name = model_name
        self._model = None
        self._content_emb = None
        self._course_ids: List[str] = []

    def _ensure_model(self) -> bool:
        if self._model is not None:
            return True
        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self._model_name)
            return True
        except Exception:
            return False

    @staticmethod
    def _course_text(course: Dict[str, Any]) -> str:
        title = course.get("title", "")
        desc = course.get("description", "")
        tags = course.get("tags") or []
        if isinstance(tags, list):
            tags = " ".join([str(t) for t in tags])
        return f"{title} {desc} {tags}".strip()

    @staticmethod
    def _student_text(student: Dict[str, Any]) -> str:
        interests = student.get("interests")
        if isinstance(interests, list):
            return " ".join([str(i) for i in interests])
        return str(interests or "")

    def fit(self, content: List[Dict[str, Any]]):
        if not self._ensure_model():
            return
        texts = [self._course_text(c) for c in content]
        self._course_ids = [str(c.get("course_id", i)) for i, c in enumerate(content)]
        self._content_emb = self._model.encode(texts, normalize_embeddings=True)

    def recommend(self, student: Dict[str, Any], top_k: int = 10) -> List[Tuple[str, float]]:
        if self._model is None or self._content_emb is None or not self._course_ids:
            return []
        import numpy as np
        s_text = self._student_text(student)
        if not s_text:
            return []
        q = self._model.encode([s_text], normalize_embeddings=True)[0]
        sims = (self._content_emb @ q).tolist()  # cosine with normalized vectors
        ranked = sorted(zip(self._course_ids, sims), key=lambda x: x[1], reverse=True)
        return ranked[:top_k]
