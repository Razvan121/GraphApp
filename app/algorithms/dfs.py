from app.core.graph import Graph
from app.core.events import StepEvent, EventType

def _neighbors(G: Graph, u):

    return [v for v, _ in G.adj.get(u, [])]

def dfs_stepper(G: Graph, start):
   
    visited: set = set()
    visit_order: list = []

    stack: list[tuple[object, int]] = [(start, 0)]

    yield StepEvent(EventType.START, {"algo": "dfs", "start": start})
    yield StepEvent(EventType.QUEUE_PUSH, {"stack": [n for n, _ in stack]})

    while stack:
        u, idx = stack[-1]


        if u not in visited:

            yield StepEvent(EventType.QUEUE_POP, {"node": u, "stack": [n for n, _ in stack[:-1]]})

            visited.add(u)
            visit_order.append(u)
            yield StepEvent(EventType.MARK_VISITED, {"node": u, "visited": list(visit_order)})
            yield StepEvent(EventType.VISIT_NODE, {"node": u})

        neighs = _neighbors(G, u)

        next_v = None
        next_i = idx
        while next_i < len(neighs):
            v = neighs[next_i]
            if v not in visited:
                next_v = v
                break
            next_i += 1

        if next_v is not None:
            stack[-1] = (u, next_i + 1)

            yield StepEvent(EventType.DISCOVER_EDGE, {"u": u, "v": next_v})
            stack.append((next_v, 0))
            yield StepEvent(EventType.QUEUE_PUSH, {"stack": [n for n, _ in stack]})
          
            continue
        else:
           
            stack.pop()
       

    yield StepEvent(EventType.END, {"algo": "dfs"})
