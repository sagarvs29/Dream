from __future__ import annotations

from typing import Any, Dict, List, Tuple


class SponsorMatcher:
    """Rule-based eligibility + fuzzy text match on sponsor descriptions."""

    def __init__(self):
        self._sponsors: List[Dict[str, Any]] = []

    def fit(self, sponsors: List[Dict[str, Any]]):
        self._sponsors = sponsors or []

    @staticmethod
    def _eligible(student: Dict[str, Any], sponsor: Dict[str, Any]) -> bool:
        criteria = sponsor.get("criteria", {}) or {}
        # Simple examples: min_gpa, required_department, min_year
        min_gpa = criteria.get("min_gpa")
        dept = criteria.get("required_department")
        min_year = criteria.get("min_year")

        profile = student.get("profile", {}) or {}
        gpa = profile.get("gpa")
        department = profile.get("department")
        year = profile.get("year")

        if min_gpa is not None and (gpa is None or gpa < min_gpa):
            return False
        if dept and department and dept != department:
            return False
        if min_year is not None and (year is None or year < min_year):
            return False
        return True

    @staticmethod
    def _text_match_score(student: Dict[str, Any], sponsor: Dict[str, Any]) -> float:
        # Lazy import rapidfuzz to avoid heavy import at module load
        try:
            from rapidfuzz import fuzz
        except Exception:
            return 0.0

        interests = student.get("interests")
        if isinstance(interests, list):
            s_text = " ".join([str(i) for i in interests])
        else:
            s_text = str(interests or "")

        desc = sponsor.get("description", "")
        if not s_text or not desc:
            return 0.0
        # Token sort ratio for rough semantic-ish score
        return float(fuzz.token_set_ratio(s_text, desc)) / 100.0

    def match(self, student: Dict[str, Any], top_k: int = 10) -> List[Tuple[str, float]]:
        scored: List[Tuple[str, float]] = []
        stu_text = " ".join([str(i) for i in (student.get("interests") or [])])
        stu_dept = (student.get("profile", {}) or {}).get("department")
        for sp in self._sponsors:
            sid = str(sp.get("sponsor_id"))
            if not sid:
                continue
            if not self._eligible(student, sp):
                continue
            base = self._text_match_score(student, sp)
            # small boost if sponsor name/description hints match department
            desc = (sp.get("description") or "") + " " + (sp.get("name") or "")
            boost = 0.0
            if stu_dept and isinstance(stu_dept, str) and stu_dept.lower() in desc.lower():
                boost += 0.05
            # keyword overlap boost
            if stu_text and any(tok.lower() in desc.lower() for tok in stu_text.split()):
                boost += 0.05
            score = 0.7 * base + 0.3 + boost
            scored.append((sid, float(score)))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]
