from collections import deque
from app.core.graph import Graph
from app.core.events import StepEvent, EventType

def bfs_stepper(G: Graph, start):
    visited = set()
    visit_order = []                 # 👈 nou: ordinea corectă
    queue = deque([start])

    yield StepEvent(EventType.START, {"algo": "bfs", "start": start})
    yield StepEvent(EventType.QUEUE_PUSH, {"queue": list(queue)})

    while queue:
        node = queue.popleft()
        yield StepEvent(EventType.QUEUE_POP, {"node": node, "queue": list(queue)})

        if node in visited:
            continue

        visited.add(node)
        visit_order.append(node)     # 👈 nou
        yield StepEvent(EventType.MARK_VISITED, {"node": node, "visited": list(visit_order)})
        yield StepEvent(EventType.VISIT_NODE, {"node": node})

        for v, _w in G.adj.get(node, []):
            if v not in visited and v not in queue:
                yield StepEvent(EventType.DISCOVER_EDGE, {"u": node, "v": v})
                queue.append(v)
                yield StepEvent(EventType.QUEUE_PUSH, {"queue": list(queue)})

    yield StepEvent(EventType.END, {"algo": "bfs"})
