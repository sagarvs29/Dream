from __future__ import annotations

import argparse
import json
from pathlib import Path

from .offline_connector import OfflineConnector
from .recommendation_engine import RecommendationEngine


def main():
    parser = argparse.ArgumentParser(description="Offline trainer using CSV/XLSX files (no MongoDB)")
    parser.add_argument("--students", default="Student_rec.xlsx")
    parser.add_argument("--content", default="Content_rec.xlsx")
    parser.add_argument("--sponsors", default="Sponsers_rec.xlsx")
    parser.add_argument("--out", default="offline_recommendations.jsonl", help="Output JSONL file")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of students (0=all)")
    args = parser.parse_args()

    conn = OfflineConnector(args.students, args.content, args.sponsors)
    engine = RecommendationEngine(conn)
    engine.train_models()

    students = conn.get_all_students()
    if args.limit and args.limit > 0:
        students = students[: args.limit]

    out_path = Path(args.out)
    with out_path.open("w", encoding="utf-8") as f:
        for s in students:
            sid = str(s.get("student_id"))
            if not sid:
                continue
            rec = engine.recommend_for_student(sid)
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"Wrote recommendations for {len(students)} students -> {out_path}")


if __name__ == "__main__":
    main()
