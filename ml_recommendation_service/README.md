# ML Recommendation Service

A standalone Python microservice that reads students, content, and sponsors from MongoDB, generates hybrid recommendations, and writes results back to the `recommendations` collection.

## Features
- Content-based TF-IDF matching (title/description/tags ↔ interests)
- Lightweight collaborative filtering (Jaccard with popularity backfill)
- Sponsor matching (rule-based eligibility + fuzzy text)
- Model persistence via joblib
- Batch runner and simple scheduler

## Setup

1. Create and activate a virtual environment (already created as `.venv` in your workspace):

2. Install dependencies:

```powershell
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m pip install -r "c:/Users/Kiran Raj K/Desktop/Rec_System/ml_recommendation_service/requirements.txt"
```

3. Configure environment (optional):
- `MONGO_URI`, `DB_NAME` and collection names if they differ.

## Usage

- Offline training (no MongoDB): reads CSV/XLSX and writes recommendations to JSONL
```powershell
python -m ml_recommendation_service.offline_train --students Student_rec.xlsx --content Content_rec.xlsx --sponsors Sponsers_rec.xlsx --out offline_recommendations.jsonl
```

- (Optional) Load your Excel sheets into MongoDB:
```powershell
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m ml_recommendation_service.data_ingest
```

- Run for a single student and save to MongoDB:
```powershell
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m ml_recommendation_service.main --student 101
```

- Run batch once for all students:
```powershell
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m ml_recommendation_service.main --batch-once
```

- Start scheduler (every N hours, default 6):
```powershell
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m ml_recommendation_service.main --schedule
```

- Smoke import test (no DB calls):
```powershell
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m ml_recommendation_service.smoke_import_test
```

## Quick local test (PowerShell-safe)

Run a tiny in-memory test without touching files/DB:

```powershell
python -m ml_recommendation_service.quick_inmemory_test
```

## Integration Guide (drop-in for your app)

Use the lightweight adapter so your app can run with dummy data now and switch to Mongo later without code changes.

Example (auto mode: uses precomputed JSONL if present, else offline files, else Mongo):

```python
from ml_recommendation_service.adapter import RecommenderService

# Create the service (auto-detects environment)
svc = RecommenderService(mode="auto")

# Check readiness and list sample IDs
print("ready:", svc.is_ready())
print("students:", svc.available_student_ids()[:5])

# Get recs for a student (string or int OK)
recs = svc.get_recommendations("101")
print(recs)
```

Explicit modes:

- Precomputed JSONL (fast, no training):
```python
svc = RecommenderService(mode="precomputed", precomputed_path="offline_recommendations.jsonl")
```

- Offline files (XLSX/CSV):
```python
svc = RecommenderService(mode="offline", students_path="Student_rec.xlsx", content_path="Content_rec.xlsx", sponsors_path="Sponsers_rec.xlsx")
```

- Mongo (env or args):
```python
svc = RecommenderService(mode="mongo", mongo_uri="mongodb://localhost:27017", db_name="recdb")
# or rely on env: MONGO_URI, DB_NAME
```

- In-memory (app holds dummy data):
```python
from ml_recommendation_service.adapter import RecommenderService

students = [{"student_id": "1", "interests": ["ai", "ml"], "profile": {"gpa": 3.5, "department": "CSE", "year": 2}}]
content = [
	{"course_id": "10", "title": "Intro to ML", "tags": ["ml", "basics"]},
	{"course_id": "20", "title": "Advanced Art", "tags": ["art"]}
]
sponsors = [{"sponsor_id": "7", "name": "TechCorp", "criteria": {"min_gpa": 3.0}}]
svc = RecommenderService(mode="inmemory", students=students, content=content, sponsors=sponsors)
print(svc.get_recommendations("1"))
```

Batch save (Mongo/offline/inmemory):
```python
svc.batch_recommendations()  # no-op for precomputed mode
```

## Expected Mongo Collections
- `students`: { student_id, profile{gpa, department, year}, interests [..], completed_courses [..], clicked_courses [..] }
- `content`: { course_id, title, description, tags [..] }
- `sponsors`: { sponsor_id, name, description, criteria{min_gpa, required_department, min_year} }
- `recommendations`: upserted by this service

## App pipeline with MongoDB (production)

1) Set env vars or edit `config.py`:
```powershell
$env:MONGO_URI = "mongodb://localhost:27017"; $env:DB_NAME = "recdb"
```

2) In your app code:
```python
from ml_recommendation_service.adapter import RecommenderService
svc = RecommenderService(mode="mongo")  # picks up env
recs = svc.get_recommendations("101")
```

3) Optional batch/scheduler (writes to recommendations collection):
```powershell
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m ml_recommendation_service.main --batch-once
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m ml_recommendation_service.main --schedule
```

## Offline pipeline (no DB)

- Train and write recommendations to JSONL:
```powershell
python -m ml_recommendation_service.offline_train --students Student_rec.xlsx --content Content_rec.xlsx --sponsors Sponsers_rec.xlsx --out offline_recommendations.jsonl
```

- Serve precomputed file instantly:
```python
from ml_recommendation_service.adapter import RecommenderService
svc = RecommenderService(mode="precomputed", precomputed_path="offline_recommendations.jsonl")
print(svc.get_recommendations("101"))
```

## Configuration and tuning

- Weights and K-values (env or edit `config.py`): CONTENT_WEIGHT, COLLAB_WEIGHT, SEMANTIC_WEIGHT, DIVERSITY_STRENGTH, TOP_K_COURSES, TOP_K_SPONSORS, TOP_K_STUDENTS, TOP_K_TEACHERS
- ANN candidate retrieval (optional): USE_ANN, ANN_N_NEIGHBORS, ANN_CANDIDATES
- Mongo collection names: STUDENTS_COLLECTION, CONTENT_COLLECTION, SPONSORS_COLLECTION, RECOMMENDATIONS_COLLECTION
- Scheduler interval: SCHEDULE_HOURS

### Config via env (PowerShell examples)

```powershell
# Weights and diversity
$env:CONTENT_WEIGHT = "0.6"; $env:COLLAB_WEIGHT = "0.35"; $env:SEMANTIC_WEIGHT = "0.05"; $env:DIVERSITY_STRENGTH = "0.05"
$env:TOP_K_COURSES = "10"; $env:TOP_K_SPONSORS = "5"; $env:TOP_K_STUDENTS = "5"; $env:TOP_K_TEACHERS = "5"

# ANN toggles
$env:USE_ANN = "true"; $env:ANN_N_NEIGHBORS = "200"; $env:ANN_CANDIDATES = "150"

# Mongo
$env:MONGO_URI = "mongodb://localhost:27017"; $env:DB_NAME = "recdb"
```

## Troubleshooting

- On Windows PowerShell, avoid complex Python one‑liners with quotes; prefer a .py file or the quick test module above.
- If Mongo isn’t running, the Mongo mode will time out; use offline or in-memory modes for local dev.

## Sample dataset demo

We include tiny sample JSON files under `ml_recommendation_service/samples/` and a runner script.

Run the sample demo and save recommendations:

```powershell
python -m ml_recommendation_service.run_samples
```

This prints recommendations for two sample students and writes `offline_recommendations.jsonl` at the project root.

## Notes
- This is a baseline hybrid model you can enhance with embeddings, bandits, and A/B tests.
- We pin to versions compatible with Python 3.13 for smooth installs.

## Advanced: Embeddings, Bandits, A/B tests

### Embeddings (semantic model)

The semantic recommender uses sentence-transformers if installed. It’s optional by default.

Install (large download; CPU works, GPU faster if available):
```powershell
"C:/Users/Kiran Raj K/Desktop/Rec_System/.venv/Scripts/python.exe" -m pip install sentence-transformers
```

Enable a higher semantic weight if desired:
```powershell
$env:SEMANTIC_WEIGHT = "0.15"
```

### Bandits (epsilon-greedy exploration)

To allow small exploration among ranked candidates (helps discover new items):
```powershell
$env:BANDIT_EPSILON = "0.1"      # 10% chance to explore
$env:BANDIT_EXPLORE_K = "2"      # replace last 2 items in top-K when exploring
```
Set `$env:BANDIT_EPSILON = "0"` to disable (default).

### A/B tests (variant flags)

Use environment flags to define variants and compare metrics in your app:
```powershell
$env:VARIANT = "A"                # or "B"
# Example: in code, switch weights or USE_ANN based on VARIANT
# if os.getenv("VARIANT") == "B": set USE_ANN=true, SEMANTIC_WEIGHT=0.2, etc.
```
We recommend logging `student_id`, variant, features, scores, and outcomes (click/apply) to evaluate lift between variants.

Adapter supports simple VARIANT presets at init time:
```powershell
# Variant B: stronger semantic, ANN on, small exploration
$env:VARIANT = "B"
python -m ml_recommendation_service.run_samples

# Variant C: content-heavy, no exploration
$env:VARIANT = "C"
python -m ml_recommendation_service.run_samples
```
