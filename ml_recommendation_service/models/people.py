from __future__ import annotations

from typing import Any, Dict, List, Tuple


class PeopleRecommender:
    """Recommend similar students and matching teachers by interest/subject text.

    Uses TF-IDF over student interests/profile and teacher subjects/keywords.
    Heavy imports are lazy in methods.
    """

    def __init__(self):
        self._vectorizer = None
        self._student_matrix = None
        self._teacher_matrix = None
        self._student_ids: List[str] = []
        self._teacher_ids: List[str] = []

    @staticmethod
    def _student_text(s: Dict[str, Any]) -> str:
        parts: List[str] = []
        ints = s.get("interests")
        if isinstance(ints, list):
            parts.extend([str(i) for i in ints])
        elif ints:
            parts.append(str(ints))
        prof = s.get("profile", {}) or {}
        for k in ("department", "major", "year"):
            v = prof.get(k)
            if v is not None and v != "":
                parts.append(str(v))
        return " ".join(parts)

    @staticmethod
    def _teacher_text(t: Dict[str, Any]) -> str:
        parts: List[str] = []
        for k in ("subjects", "keywords", "bio", "department"):
            v = t.get(k)
            if isinstance(v, list):
                parts.extend([str(x) for x in v])
            elif v:
                parts.append(str(v))
        return " ".join(parts)

    def fit(self, students: List[Dict[str, Any]], teachers: List[Dict[str, Any]] | None = None):
        from sklearn.feature_extraction.text import TfidfVectorizer

        stu_texts = [self._student_text(s) for s in students]
        self._student_ids = [str(s.get("student_id", i)) for i, s in enumerate(students)]
        # Single vectorizer to keep space aligned
        self._vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
        self._student_matrix = self._vectorizer.fit_transform(stu_texts)

        self._teacher_matrix = None
        self._teacher_ids = []
        if teachers:
            t_texts = [self._teacher_text(t) for t in teachers]
            self._teacher_ids = [str(t.get("teacher_id", i)) for i, t in enumerate(teachers)]
            self._teacher_matrix = self._vectorizer.transform(t_texts)

    def similar_students(self, student: Dict[str, Any], top_k: int = 5) -> List[Tuple[str, float]]:
        if self._vectorizer is None or self._student_matrix is None:
            return []
        from sklearn.metrics.pairwise import cosine_similarity
        q = self._vectorizer.transform([self._student_text(student)])
        sims = cosine_similarity(q, self._student_matrix)[0]
        # zero-out self match if present
        sid = str(student.get("student_id"))
        try:
            idx = self._student_ids.index(sid)
            sims[idx] = 0.0
        except ValueError:
            pass
        # normalize for stability
        max_sim = float(sims.max()) if sims.size > 0 else 1.0
        sims = sims / (max_sim or 1.0)
        ranked = sorted(zip(self._student_ids, sims), key=lambda x: x[1], reverse=True)
        return ranked[:top_k]

    def matching_teachers(self, student: Dict[str, Any], top_k: int = 5) -> List[Tuple[str, float]]:
        if self._vectorizer is None or self._teacher_matrix is None:
            return []
        from sklearn.metrics.pairwise import cosine_similarity
        q = self._vectorizer.transform([self._student_text(student)])
        sims = cosine_similarity(q, self._teacher_matrix)[0]
        max_sim = float(sims.max()) if sims.size > 0 else 1.0
        sims = sims / (max_sim or 1.0)
        ranked = sorted(zip(self._teacher_ids, sims), key=lambda x: x[1], reverse=True)
        return ranked[:top_k]
