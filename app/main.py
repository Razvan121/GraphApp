from __future__ import annotations
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi import HTTPException

from app.core.graph import Graph
from app.schemas.api import GraphIn, SessionOut, StepEventOut
from app.services.sessions import STORE, Session
from app.services.runners import Runner
from app.utils.ids import new_session_id

import traceback

app = FastAPI(title="GRAPHAPP")

@app.get("/health")
def health():
    return {"ok": True}

from fastapi import HTTPException
import traceback

@app.post("/sessions", response_model=SessionOut)
def create_session(payload: GraphIn, algo: str = "bfs", start: str | int | None = None):
    try:
        data = payload.model_dump()
        G = Graph(directed=data["directed"], weighted=data["weighted"])

        # 🔧 normalizează TOATE ID-urile la string
        nodes = [str(n) for n in data["nodes"]]
        for n in nodes:
            G.add_node(n)

        for e in data["edges"]:
            u = str(e["u"])
            v = str(e["v"])
            w = e.get("w")
            G.add_edge(u, v, w)

        if start is None and nodes:
            start = nodes[0]
        else:
            start = str(start) if start is not None else None

        sid = new_session_id()
        sess = Session(graph=G, algo=algo, start=start)
        sess.iterator = Runner.make_iterator(algo, G, start)
        STORE.put(sid, sess)
        return SessionOut(session_id=sid)

    except Exception as ex:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"create_session failed: {ex!s}")



@app.post("/sessions/{sid}/step", response_model=StepEventOut)
def step_session(sid: str):
    sess = STORE.get(sid)
    if not sess or not sess.iterator:
        raise HTTPException(404, "Unknown session")
    ev = Runner.step(sess.iterator)
    if ev is None:
        return StepEventOut(type="end", data={})
    return StepEventOut(type=ev.type.value, data=ev.data)

@app.websocket("/ws/sessions/{sid}")
async def ws_session(ws: WebSocket, sid: str):
    await ws.accept()
    sess = STORE.get(sid)
    if not sess or not sess.iterator:
        await ws.close(code=1008)
        return
    try:
        while True:
            await ws.receive_text()
            ev = Runner.step(sess.iterator)
            if ev is None:
                await ws.send_json({"type": "end", "data": {}})
                break
            await ws.send_json({"type": ev.type.value, "data": ev.data})
    except WebSocketDisconnect:
        pass
@app.get("/sessions/{sid}/adj")
def debug_adj(sid: str):
    sess = STORE.get(sid)
    if not sess:
        raise HTTPException(404, "Unknown session")
    return sess.graph.adj

