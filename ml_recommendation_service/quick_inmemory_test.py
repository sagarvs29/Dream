from ml_recommendation_service.adapter import RecommenderService


def main():
    students = [{"student_id": "1", "interests": ["ml", "ai"], "profile": {"gpa": 3.2, "department": "CSE", "year": 2}}]
    content = [
        {"course_id": "c1", "title": "ML 101", "description": "Intro to machine learning and AI basics", "tags": ["ml", "intro", "ai"]},
        {"course_id": "c2", "title": "Art", "description": "Drawing and painting fundamentals", "tags": ["drawing", "art"]},
    ]
    svc = RecommenderService(mode="inmemory", students=students, content=content)
    print(svc.get_recommendations("1"))


if __name__ == "__main__":
    main()
