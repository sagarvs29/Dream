from __future__ import annotations

from typing import Any, Dict, List, Optional
from datetime import datetime

from .config import (
    MONGO_URI,
    DB_NAME,
    STUDENTS_COLLECTION,
    CONTENT_COLLECTION,
    SPONSORS_COLLECTION,
    RECOMMENDATIONS_COLLECTION,
)


class MongoDBConnector:
    """Thin wrapper around PyMongo with safe defaults and convenience helpers."""

    def __init__(self, connection_string: Optional[str] = None, db_name: Optional[str] = None):
        self._conn_str = connection_string or MONGO_URI
        self._db_name = db_name or DB_NAME
        # Lazy import so module import works without pymongo installed
        try:
            from pymongo import MongoClient
        except Exception as e:  # pragma: no cover - import-time fallback
            raise RuntimeError(
                "pymongo is required to use MongoDBConnector. Install dependencies from requirements.txt"
            ) from e

        # Connect with short timeouts and connection pooling
        self._client = MongoClient(self._conn_str, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
        self._db = self._client[self._db_name]

        # Ensure indexes that help common access patterns
        self._db[STUDENTS_COLLECTION].create_index("student_id", unique=True, background=True)
        self._db[CONTENT_COLLECTION].create_index("course_id", unique=True, background=True)
        self._db[SPONSORS_COLLECTION].create_index("sponsor_id", unique=True, background=True)
        self._db[RECOMMENDATIONS_COLLECTION].create_index("student_id", unique=True, background=True)

    # ---- getters ----
    def get_all_students(self) -> List[Dict[str, Any]]:
        return list(self._db[STUDENTS_COLLECTION].find({}))

    def get_all_content(self) -> List[Dict[str, Any]]:
        return list(self._db[CONTENT_COLLECTION].find({}))

    def get_all_sponsors(self) -> List[Dict[str, Any]]:
        return list(self._db[SPONSORS_COLLECTION].find({}))

    def get_student_profile(self, student_id: str) -> Optional[Dict[str, Any]]:
        return self._db[STUDENTS_COLLECTION].find_one({"student_id": str(student_id)})

    # ---- upserts ----
    def save_recommendations(
        self,
        student_id: str,
        recommendations: Dict[str, Any],
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        doc = {
            "student_id": str(student_id),
            "courses": recommendations.get("courses", []),
            "sponsors": recommendations.get("sponsors", []),
            "created_at": datetime.utcnow(),
        }
        if extra:
            doc.update(extra)
        self._db[RECOMMENDATIONS_COLLECTION].update_one(
            {"student_id": str(student_id)},
            {"$set": doc},
            upsert=True,
        )
