"""Weighted directed OD network metrics (networkx). Edges: known-zone OD pairs, o != d, >= K_MIN trips.

PageRank weight = trips (flow attracts rank). Betweenness uses edge length = 1/trips so that heavy
flows are 'short' links; computed exactly (263 nodes, so no sampling needed).
"""
from __future__ import annotations

import networkx as nx
import numpy as np
import polars as pl

from pipelines.common import K_MIN


def build_graph(od: pl.DataFrame) -> nx.DiGraph:
    e = od.filter((pl.col("o") != pl.col("d")) & (pl.col("trips") >= K_MIN))
    g = nx.DiGraph()
    for o, d, t in zip(e["o"].to_list(), e["d"].to_list(), e["trips"].to_list()):
        g.add_edge(int(o), int(d), weight=float(t), length=1.0 / float(t))
    return g


def metrics(g: nx.DiGraph, zones: list[int]) -> pl.DataFrame:
    g = g.copy()
    g.add_nodes_from(zones)
    pr = nx.pagerank(g, alpha=0.85, weight="weight", tol=1e-12, max_iter=1000)
    bc = nx.betweenness_centrality(g, weight="length", normalized=True)
    ins = dict(g.in_degree(weight="weight"))
    outs = dict(g.out_degree(weight="weight"))
    return pl.DataFrame({"zone": zones, "pagerank": [pr[z] for z in zones], "in_strength": [ins[z] for z in zones],
                         "out_strength": [outs[z] for z in zones], "betweenness": [bc[z] for z in zones]})
