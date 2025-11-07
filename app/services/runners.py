from __future__ import annotations
from typing import Iterator

from app.algorithms.bfs import bfs_stepper
from app.algorithms.dfs import dfs_stepper
from app.core.graph import Graph
from app.core.events import StepEvent


ALGOS = {
    "bfs" : bfs_stepper,
    "dfs" : dfs_stepper
}

class Runner:
    @staticmethod
    def make_iterator(algo:str, G:Graph, start):
        factory = ALGOS.get(algo)
        if not factory:
            raise ValueError(f"Unknown algorithm {algo}")
        return factory(G, start)
    
    @staticmethod
    def step(it: Iterator[StepEvent] )-> StepEvent | None:
        try:
            return next(it)
        except StopIteration:
            return None