from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Any, List

class EdgeIn(BaseModel):
    u: str | int
    v: str | int
    w: float | None = None

class GraphIn(BaseModel):
    directed: bool = False
    weighted: bool = False
    nodes: List[str | int] = Field(default_factory=list)
    edges: List[EdgeIn] = Field(default_factory=list)

class SessionOut(BaseModel):
    session_id: str

class StepEventOut(BaseModel):
    type: str
    data: dict[str, Any]
