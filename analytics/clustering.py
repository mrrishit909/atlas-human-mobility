"""Zone clustering on the normalized 168-hour weekly pickup profile (k-means, k by silhouette)."""
from __future__ import annotations

import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score

SEED = 20240101
KS = range(3, 9)


def normalize(m: np.ndarray) -> np.ndarray:
    """L1-normalize each zone profile: shape of the week, independent of volume."""
    return m / m.sum(axis=1, keepdims=True)


def fit(x: np.ndarray, k: int, seed: int = SEED) -> np.ndarray:
    return KMeans(n_clusters=k, n_init=10, random_state=seed).fit_predict(x)


def select_k(x: np.ndarray, seed: int = SEED) -> tuple[int, dict[int, float]]:
    sil = {k: float(silhouette_score(x, fit(x, k, seed))) for k in KS}
    return max(sil, key=sil.get), sil


def stability(x: np.ndarray, k: int, n_seeds: int = 10) -> dict:
    ref = fit(x, k, SEED)
    aris = [adjusted_rand_score(ref, fit(x, k, SEED + 1 + s)) for s in range(n_seeds)]
    return {"ari_mean": float(np.mean(aris)), "ari_min": float(np.min(aris)), "n_seeds": n_seeds}


def random_baseline(x: np.ndarray, labels: np.ndarray, n: int = 20, seed: int = SEED) -> dict:
    """Silhouette of random permutations of the real cluster labels (same sizes)."""
    rng = np.random.default_rng(seed)
    s = [float(silhouette_score(x, rng.permutation(labels))) for _ in range(n)]
    return {"mean": float(np.mean(s)), "max": float(np.max(s))}


def order_labels(labels: np.ndarray, counts: np.ndarray) -> np.ndarray:
    """Relabel clusters 0..k-1 by descending total volume so ids are stable across reruns."""
    k = labels.max() + 1
    tot = np.array([counts[labels == c].sum() for c in range(k)])
    rank = {c: r for r, c in enumerate(np.argsort(-tot, kind="stable"))}
    return np.array([rank[c] for c in labels])
