from __future__ import annotations

import os
from typing import Any, Dict
import pandas as pd

from .mongo_connector import MongoDBConnector
from .config import (
    MONGO_URI,
    DB_NAME,
    STUDENTS_COLLECTION,
    CONTENT_COLLECTION,
    SPONSORS_COLLECTION,
)


EXCEL_STUDENTS = os.getenv("EXCEL_STUDENTS", "Student_rec.xlsx")
EXCEL_CONTENT = os.getenv("EXCEL_CONTENT", "Content_rec.xlsx")
EXCEL_SPONSORS = os.getenv("EXCEL_SPONSORS", "Sponsers_rec.xlsx")


def _resolve_path(pref: str, csv_alt: str) -> str | None:
    """Return an existing path: prefer pref, else csv_alt if exists, else None."""
    if os.path.exists(pref):
        return pref
    if os.path.exists(csv_alt):
        return csv_alt
    return None


def _to_records(df: pd.DataFrame) -> list[Dict[str, Any]]:
    return df.replace({pd.NA: None}).to_dict(orient="records")


def load_excels_into_mongo():
    conn = MongoDBConnector(MONGO_URI, DB_NAME)
    # Students
    students_path = _resolve_path(EXCEL_STUDENTS, "Student_rec.csv")
    if students_path:
        if students_path.lower().endswith(".xlsx"):
            s_df = pd.read_excel(students_path)
        else:
            s_df = pd.read_csv(students_path)
        # Normalize columns if needed
        # Expect columns: student_id, interests (comma-separated), profile.gpa, profile.department, profile.year
        records = []
        for r in _to_records(s_df):
            interests = r.get("interests")
            if isinstance(interests, str):
                r["interests"] = [x.strip() for x in interests.split(",") if x.strip()]
            profile = {
                "gpa": r.pop("gpa", None) or r.pop("profile.gpa", None),
                "department": r.pop("department", None) or r.pop("profile.department", None),
                "year": r.pop("year", None) or r.pop("profile.year", None),
            }
            r["profile"] = {k: v for k, v in profile.items() if v is not None}
            r["student_id"] = str(r.get("student_id"))
            records.append(r)
        if records:
            coll = conn._db[STUDENTS_COLLECTION]
            coll.delete_many({})
            coll.insert_many(records)
            print(f"Inserted {len(records)} students")

    # Content
    content_path = _resolve_path(EXCEL_CONTENT, "Content_rec.csv")
    if content_path:
        if content_path.lower().endswith(".xlsx"):
            c_df = pd.read_excel(content_path)
        else:
            c_df = pd.read_csv(content_path)
        records = []
        for r in _to_records(c_df):
            tags = r.get("tags")
            if isinstance(tags, str):
                r["tags"] = [x.strip() for x in tags.split(",") if x.strip()]
            r["course_id"] = str(r.get("course_id"))
            records.append(r)
        if records:
            coll = conn._db[CONTENT_COLLECTION]
            coll.delete_many({})
            coll.insert_many(records)
            print(f"Inserted {len(records)} courses")

    # Sponsors
    sponsors_path = _resolve_path(EXCEL_SPONSORS, "Sponsers_rec.csv")
    if sponsors_path:
        if sponsors_path.lower().endswith(".xlsx"):
            sp_df = pd.read_excel(sponsors_path)
        else:
            sp_df = pd.read_csv(sponsors_path)
        records = []
        for r in _to_records(sp_df):
            crit = {}
            if "min_gpa" in r and pd.notna(r["min_gpa"]):
                crit["min_gpa"] = float(r["min_gpa"])  # type: ignore[arg-type]
            if "required_department" in r and pd.notna(r["required_department"]):
                crit["required_department"] = str(r["required_department"])  # type: ignore[arg-type]
            if "min_year" in r and pd.notna(r["min_year"]):
                crit["min_year"] = int(r["min_year"])  # type: ignore[arg-type]
            r["criteria"] = crit
            r["sponsor_id"] = str(r.get("sponsor_id"))
            records.append(r)
        if records:
            coll = conn._db[SPONSORS_COLLECTION]
            coll.delete_many({})
            coll.insert_many(records)
            print(f"Inserted {len(records)} sponsors")


if __name__ == "__main__":
    load_excels_into_mongo()
