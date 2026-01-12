from __future__ import annotations

from typing import List, Dict, Any
import numpy as np

try:
    from sklearn.neighbors import NearestNeighbors
except Exception:  # pragma: no cover
    NearestNeighbors = None  # type: ignore


class ANNRetriever:
    """Approximate nearest neighbor style retriever using scikit-learn KNN.

    Uses cosine distance over TF-IDF course vectors (from ContentBasedRecommender) to
    quickly retrieve top-N candidate courses for a student's TF-IDF interest vector.
    This is a CPU-friendly baseline; in large-scale production, switch to FAISS/HNSW.
    """

    def __init__(self, n_neighbors: int = 200, metric: str = "cosine") -> None:
        self.n_neighbors = n_neighbors
        self.metric = metric
        self._nn = None
        self._course_ids: List[str] = []
        self._matrix = None

    def fit(self, course_matrix, course_ids: List[str]) -> None:
        if NearestNeighbors is None or course_matrix is None or len(course_ids) == 0:
            return
        self._course_ids = list(course_ids)
        self._matrix = course_matrix
        k = min(self.n_neighbors, len(self._course_ids))
        self._nn = NearestNeighbors(n_neighbors=k, metric=self.metric, algorithm="auto")
        self._nn.fit(self._matrix)

    def retrieve(self, student_vector, top_k: int = 200) -> List[str]:
        if self._nn is None or student_vector is None:
            return []
        if hasattr(student_vector, "toarray"):
            q = student_vector.toarray()
        else:
            q = np.asarray(student_vector)
            if q.ndim == 1:
                q = q[None, :]
        k = min(top_k, len(self._course_ids))
        distances, indices = self._nn.kneighbors(q, n_neighbors=k)
        order = indices[0].tolist()
        return [self._course_ids[i] for i in order]
