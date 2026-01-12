import os

# MongoDB configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "student_app")

# Collection names
STUDENTS_COLLECTION = os.getenv("STUDENTS_COLLECTION", "students")
CONTENT_COLLECTION = os.getenv("CONTENT_COLLECTION", "content")
SPONSORS_COLLECTION = os.getenv("SPONSORS_COLLECTION", "sponsors")
RECOMMENDATIONS_COLLECTION = os.getenv("RECOMMENDATIONS_COLLECTION", "recommendations")

# Algorithm weights and settings
CONTENT_WEIGHT = float(os.getenv("CONTENT_WEIGHT", 0.6))
COLLAB_WEIGHT = float(os.getenv("COLLAB_WEIGHT", 0.35))
SEMANTIC_WEIGHT = float(os.getenv("SEMANTIC_WEIGHT", 0.05))
DIVERSITY_STRENGTH = float(os.getenv("DIVERSITY_STRENGTH", 0.05))
TOP_K_COURSES = int(os.getenv("TOP_K_COURSES", 10))
TOP_K_SPONSORS = int(os.getenv("TOP_K_SPONSORS", 10))
TOP_K_STUDENTS = int(os.getenv("TOP_K_STUDENTS", 5))
TOP_K_TEACHERS = int(os.getenv("TOP_K_TEACHERS", 5))

# ANN retrieval settings (first-stage candidate generation)
USE_ANN = os.getenv("USE_ANN", "true").lower() in {"1", "true", "yes"}
ANN_N_NEIGHBORS = int(os.getenv("ANN_N_NEIGHBORS", 200))
ANN_CANDIDATES = int(os.getenv("ANN_CANDIDATES", 150))

# Bandit exploration (optional, default off)
BANDIT_EPSILON = float(os.getenv("BANDIT_EPSILON", 0.0))  # 0..1, probability of explore
BANDIT_EXPLORE_K = int(os.getenv("BANDIT_EXPLORE_K", 3))  # number of items to randomize into top-K

# Scheduler
SCHEDULE_HOURS = float(os.getenv("SCHEDULE_HOURS", 6))
