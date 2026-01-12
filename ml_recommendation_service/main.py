from __future__ import annotations

import argparse
import time

from .config import MONGO_URI, DB_NAME, SCHEDULE_HOURS
from .mongo_connector import MongoDBConnector
from .recommendation_engine import RecommendationEngine


def run_once(student_id: str | None, batch: bool):
    connector = MongoDBConnector(MONGO_URI, DB_NAME)
    engine = RecommendationEngine(connector)
    engine.train_models()
    if student_id:
        rec = engine.recommend_for_student(student_id)
        connector.save_recommendations(student_id, rec)
        print(f"Saved recommendations for student {student_id}")
    if batch:
        engine.batch_recommendations()
        print("Batch recommendations complete")


def run_scheduler():
    import schedule

    connector = MongoDBConnector(MONGO_URI, DB_NAME)
    engine = RecommendationEngine(connector)
    engine.train_models()

    def job():
        engine.train_models()
        engine.batch_recommendations()
        print("[schedule] Batch recommendations done")

    # Run once immediately
    job()

    # Schedule every N hours
    schedule.every(SCHEDULE_HOURS).hours.do(job)
    print(f"Scheduler started: every {SCHEDULE_HOURS} hours")
    while True:
        schedule.run_pending()
        time.sleep(1)


def main():
    parser = argparse.ArgumentParser(description="ML Recommendation Service runner")
    parser.add_argument("--student", type=str, default=None, help="Run for a single student id")
    parser.add_argument("--batch-once", action="store_true", help="Run batch for all students once")
    parser.add_argument("--schedule", action="store_true", help="Start scheduler (every N hours)")
    args = parser.parse_args()

    if args.schedule:
        run_scheduler()
    else:
        run_once(args.student, args.batch_once)


if __name__ == "__main__":
    main()
