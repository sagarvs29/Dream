from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Tuple


class CollaborativeRecommender:
    """Lightweight collaborative filtering using co-occurrence and Jaccard similarity.

    Assumes students may have `completed_courses` or `clicked_courses` lists.
    """

    def __init__(self):
        self._user_items: Dict[str, set] = {}
        self._item_popularity: Dict[str, int] = defaultdict(int)

    @staticmethod
    def _extract_items(student: Dict[str, Any]) -> List[str]:
        items = []
        for key in ("completed_courses", "clicked_courses"):
            v = student.get(key)
            if isinstance(v, list):
                items.extend([str(x) for x in v])
        return list(dict.fromkeys(items))  # dedupe, preserve order

    def fit(self, students: List[Dict[str, Any]]):
        self._user_items = {}
        self._item_popularity.clear()
        for s in students:
            sid = str(s.get("student_id"))
            items = set(self._extract_items(s))
            if not sid:
                continue
            self._user_items[sid] = items
            for it in items:
                self._item_popularity[it] += 1

    def recommend(self, student: Dict[str, Any], top_k: int = 10) -> List[Tuple[str, float]]:
        sid = str(student.get("student_id"))
        my_items = self._user_items.get(sid, set())

        # If no history, fallback to popularity
        if not my_items:
            ranked = sorted(self._item_popularity.items(), key=lambda x: x[1], reverse=True)
            if not ranked:
                return []
            max_pop = float(ranked[0][1]) or 1.0
            return [(cid, float(pop) / max_pop) for cid, pop in ranked[:top_k]]

        # Score items by Jaccard similarity via similar users
        scores: Dict[str, float] = defaultdict(float)
        for other_sid, items in self._user_items.items():
            if other_sid == sid or not items:
                continue
            inter = len(my_items & items)
            union = len(my_items | items)
            if union == 0:
                continue
            sim = inter / union
            if sim <= 0:
                continue
            for it in items:
                if it in my_items:
                    continue
                scores[it] += sim

        # Backfill with popularity if needed
        if len(scores) < top_k:
            for it, pop in sorted(self._item_popularity.items(), key=lambda x: x[1], reverse=True):
                if it not in scores and it not in my_items:
                    scores[it] = 0.1 * float(pop)
                if len(scores) >= top_k:
                    break

        # Normalize to 0..1 for stability
        if scores:
            max_score = max(scores.values()) or 1.0
            scores = {k: (v / max_score) for k, v in scores.items()}

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        return [(cid, float(score)) for cid, score in ranked]
