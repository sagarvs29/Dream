from __future__ import annotations

from typing import Any, Dict, List, Optional
import os
import pandas as pd


def _read_tabular(path: str) -> pd.DataFrame:
    if path.lower().endswith(".xlsx"):
        return pd.read_excel(path)
    return pd.read_csv(path)


class OfflineConnector:
    """Drops-in for MongoDBConnector but reads from local CSV/XLSX files."""

    def __init__(
        self,
        students_path: str = "Student_rec.xlsx",
        content_path: str = "Content_rec.xlsx",
        sponsors_path: str = "Sponsers_rec.xlsx",
    ):
        # Fallback to CSV if XLSX missing
        if not os.path.exists(students_path) and os.path.exists("Student_rec.csv"):
            students_path = "Student_rec.csv"
        if not os.path.exists(content_path) and os.path.exists("Content_rec.csv"):
            content_path = "Content_rec.csv"
        if not os.path.exists(sponsors_path) and os.path.exists("Sponsers_rec.csv"):
            sponsors_path = "Sponsers_rec.csv"

        self._students_df = _read_tabular(students_path)
        self._content_df = _read_tabular(content_path)
        self._sponsors_df = _read_tabular(sponsors_path)

        # Normalize
        self._students = self._normalize_students(self._students_df)
        self._content = self._normalize_content(self._content_df)
        self._sponsors = self._normalize_sponsors(self._sponsors_df)

    @staticmethod
    def _normalize_students(df: pd.DataFrame) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for r in df.replace({pd.NA: None}).to_dict(orient="records"):
            interests = r.get("interests")
            if isinstance(interests, str):
                # split on comma or semicolon
                parts = [p.strip() for p in re_split(interests) if p.strip()]
                r["interests"] = parts
            profile = {
                "gpa": r.pop("gpa", None) or r.pop("profile.gpa", None),
                "department": r.pop("department", None) or r.pop("profile.department", None),
                "year": r.pop("year", None) or r.pop("profile.year", None),
            }
            r["profile"] = {k: v for k, v in profile.items() if v is not None}
            r["student_id"] = str(r.get("student_id"))
            out.append(r)
        return out

    @staticmethod
    def _normalize_content(df: pd.DataFrame) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for r in df.replace({pd.NA: None}).to_dict(orient="records"):
            tags = r.get("tags")
            if isinstance(tags, str):
                r["tags"] = [p.strip() for p in re_split(tags) if p.strip()]
            cid = r.get("course_id")
            r["course_id"] = str(cid if cid not in (None, "") else f"course_{len(out)}")
            out.append(r)
        return out

    @staticmethod
    def _normalize_sponsors(df: pd.DataFrame) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for r in df.replace({pd.NA: None}).to_dict(orient="records"):
            crit = {}
            if "min_gpa" in r and pd.notna(r["min_gpa"]):
                crit["min_gpa"] = float(r["min_gpa"])  # type: ignore[arg-type]
            if "required_department" in r and pd.notna(r["required_department"]):
                crit["required_department"] = str(r["required_department"])  # type: ignore[arg-type]
            if "min_year" in r and pd.notna(r["min_year"]):
                crit["min_year"] = int(r["min_year"])  # type: ignore[arg-type]
            r["criteria"] = crit
            r["sponsor_id"] = str(r.get("sponsor_id"))
            out.append(r)
        return out

# helper splitter supports comma or semicolon
def re_split(text: str) -> List[str]:
    import re
    return re.split(r"[;,]", text)

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

    # Stub save (offline). No-op here.
    def save_recommendations(self, student_id: str, recommendations: Dict[str, Any], extra: Optional[Dict[str, Any]] = None) -> None:  # noqa: D401
        return None
