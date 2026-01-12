def main():
    # Import modules to ensure package structure is valid
    import importlib
    for mod in [
        "ml_recommendation_service.config",
        "ml_recommendation_service.mongo_connector",
        "ml_recommendation_service.recommendation_engine",
        "ml_recommendation_service.adapter",
        "ml_recommendation_service.models.content_based",
        "ml_recommendation_service.models.collaborative",
        "ml_recommendation_service.models.sponsor_matching",
    "ml_recommendation_service.models.semantic",
        "ml_recommendation_service.utils.similarity",
    ]:
        try:
            importlib.import_module(mod)
            print(f"OK: {mod}")
        except Exception as e:
            print(f"FAIL: {mod} -> {e}")


if __name__ == "__main__":
    main()
