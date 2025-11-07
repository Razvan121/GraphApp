from __future__ import annotations
from dataclasses import dataclass,field
from typing import Dict, List, Tuple, Hashable

NodeId = Hashable

@dataclass
class Graph:
    directed: bool = False
    weighted: bool = False

    adj: Dict[NodeId, List[Tuple[NodeId,float | None]]] = field(default_factory=dict)

    def add_node(self, u: NodeId) -> None:
        if u not in self.adj:
            self.adj[u] = []

    def add_edge(self, u, v, w: float | None = None) -> None:
        self.add_node(u)
        self.add_node(v)
        if not self.weighted:
            w = None
        self.adj[u].append((v, w))
        if not self.directed:
            self.adj[v].append((u, w))
