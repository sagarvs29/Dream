from __future__ import annotations

from typing import List


def top_k(ranked: List[tuple], k: int) -> List[tuple]:
    return ranked[:k] if ranked else []
