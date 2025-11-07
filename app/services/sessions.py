from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Iterator, Optional

from app.core.graph import Graph
from app.core.events import StepEvent


@dataclass
class Session:
    graph: Graph
    algo: str
    start: str | int | None = None
    iterator: Optional[Iterator[StepEvent]] = None
    paused: bool = True

class SessionStore:
    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}

    def put(self,sid: str, session:Session) -> None:
        self._sessions[sid] = session

    def get(self, sid:str) -> Session | None:
        return self._sessions.get(sid)
    
    def remove(self,sid:str)->None:
        self._sessions.pop(sid,None)

STORE = SessionStore()