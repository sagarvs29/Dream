import json
from pathlib import Path
import os
from ml_recommendation_service.adapter import RecommenderService

SAMPLES = Path(__file__).parent / "samples"


def load_json(name: str):
    with open(SAMPLES / name, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    students = load_json("sample_students.json")
    content = load_json("sample_content.json")
    sponsors = load_json("sample_sponsors.json")

    variant = os.getenv("VARIANT", "(none)")
    print(f"Running sample demo with VARIANT={variant}")
    svc = RecommenderService(mode="inmemory", students=students, content=content, sponsors=sponsors)

    # After service init, show effective key weights/flags (import config lazily after adapter sets overrides)
    try:
        from ml_recommendation_service import config as cfg
        print("Effective config: ")
        print(f"  CONTENT_WEIGHT={cfg.CONTENT_WEIGHT} COLLAB_WEIGHT={cfg.COLLAB_WEIGHT} SEMANTIC_WEIGHT={cfg.SEMANTIC_WEIGHT}")
        print(f"  USE_ANN={getattr(cfg, 'USE_ANN', None)} BANDIT_EPSILON={getattr(cfg, 'BANDIT_EPSILON', None)}")
    except Exception as e:
        print(f"(Could not load config for debug: {e})")

    for s in students:
        sid = str(s.get("student_id"))
        recs = svc.get_recommendations(sid)
        print(f"\n=== Recommendations for student {sid} ===")
        print(json.dumps(recs, indent=2))

    # Optional: write JSONL file to the project root
    out_path = Path(__file__).parent.parent / "offline_recommendations.jsonl"
    with open(out_path, "w", encoding="utf-8") as f:
        for s in students:
            sid = str(s.get("student_id"))
            recs = svc.get_recommendations(sid)
            f.write(json.dumps(recs) + "\n")
    print(f"\nSaved sample recommendations to: {out_path}")


if __name__ == "__main__":
    main()
