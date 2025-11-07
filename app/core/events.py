from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Any


class EventType(str,Enum):
    START = "start"
    STEP = "step"
    VISIT_NODE = "visit_node"
    DISCOVER_EDGE = "discover_edge"
    QUEUE_PUSH = "queue_push"
    QUEUE_POP  = "queue_pop"
    MARK_VISITED  = "mark_visited"

    PQ_PUSH = "pq_push"
    PQ_POP = "pq_pop"
    DIST_UPDATE = "dist_update"
    RELAX_EDGE  = "relax_edge"
    END = "end"


@dataclass
class StepEvent:
    type: EventType
    data: dict[str,Any]

