import  { useEffect, useMemo, useRef, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import type cytoscape from "cytoscape";  


type StepEvent = {
  type: string;
  data: Record<string, any>;
};

type GraphIn = {
  directed: boolean;
  weighted: boolean;
  nodes: (string | number)[];
  edges: { u: string | number; v: string | number; w?: number | null }[];
};

const API_BASE = "";

function parseNodes(input: string): (string | number)[] {
  return input
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.match(/^[-+]?\d+$/) ? Number(s) : s));
}

function parseEdges(input: string) {
  const lines = input
    .split(/\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean);
  const edges: GraphIn["edges"] = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [uRaw, vRaw, wRaw] = parts;
    const u = uRaw.match(/^[-+]?\d+$/) ? Number(uRaw) : uRaw;
    const v = vRaw.match(/^[-+]?\d+$/) ? Number(vRaw) : vRaw;
    const w = wRaw !== undefined ? Number(wRaw) : undefined;
    edges.push({ u, v, w: Number.isFinite(w) ? (w as number) : undefined });
  }
  return edges;
}

function useInterval(callback: () => void, delay: number | null) {
  const savedRef = useRef(callback);
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export default function GraphAlgoLabUI() {

  const cyRef = useRef<cytoscape.Core | null>(null);
  const [directed, setDirected] = useState(false);
  const [weighted, setWeighted] = useState(false);
  const [algo, setAlgo] = useState<"bfs" | "dfs" | "dijkstra">("bfs");
  const [nodesText, setNodesText] = useState("1,2,3,4");
  const [edgesText, setEdgesText] = useState("1 2\n1 3\n2 4");
  const [startNode, setStartNode] = useState<string>("1");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [log, setLog] = useState<StepEvent[]>([]);
  const [visited, setVisited] = useState<Array<string | number>>([]);
  const [queue, setQueue] = useState<Array<string | number>>([]); 
  const [pq, setPQ] = useState<Array<[number, string | number]>>([]); 
  const [dist, setDist] = useState<Record<string, number>>({});
  const [prevMap, setPrevMap] = useState<Record<string, string | number | null>>({});
  const [currentNode, setCurrentNode] = useState<string | number | null>(null);
  const [running, setRunning] = useState(false);
  const [ended, setEnded] = useState(false);


  const [useWS, setUseWS] = useState(true);  
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const inFlightRef = useRef(false); 


  function applyEvent(ev: StepEvent) {
    setLog((l) => [...l, ev]);

    switch (ev.type) {
      case "start":
        setCurrentNode(null);
        break;

      case "mark_visited": {
        const vis = Array.isArray(ev.data.visited) ? ev.data.visited : [];
        setVisited(vis);
        break;
      }

      case "queue_push": {
        const q = ev.data.queue ?? ev.data.stack ?? [];
        setQueue(q);
        break;
      }

      case "queue_pop": {
        const q = ev.data.queue ?? ev.data.stack ?? [];
        setQueue(q);
        setCurrentNode(ev.data.node ?? null);
        break;
      }

      case "visit_node":
        setCurrentNode(ev.data.node ?? null);
        break;

      case "discover_edge":
        break;

      case "pq_push":
      case "pq_pop":
        setPQ(ev.data.pq || []);
        if (ev.data.node) setCurrentNode(ev.data.node);
        break;

      case "dist_update":
        setDist(ev.data.dist || {});
        setPrevMap(ev.data.prev || {});
        break;

      case "end":
        setEnded(true);
        setRunning(false);
        break;
    }
  }

  function connectWS(sid: string) {
  // Folosește backend-ul direct. Dacă ai proxy Vite, poți ține tot așa.
  const url = `ws://127.0.0.1:8000/ws/sessions/${sid}`;
  const ws = new WebSocket(url);

  wsRef.current = ws;

  ws.onopen = () => setWsConnected(true);
  ws.onclose = () => {
    setWsConnected(false);
    wsRef.current = null;
  };
  ws.onerror = () => {
    setWsConnected(false);
  };
  ws.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data) as StepEvent;
      applyEvent(ev);
      inFlightRef.current = false; // am primit răspuns la pasul anterior
    } catch {
      // ignore parse errors
    }
  };
}

function wsStepOnce() {
  const ws = wsRef.current;
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  if (inFlightRef.current) return; 
  inFlightRef.current = true;
  ws.send("step"); 
}





  // Build elements for Cytoscape
  const elements = useMemo(() => {
    const ns = parseNodes(nodesText);
    const es = parseEdges(edgesText);
    const nodes = ns.map((n) => ({ data: { id: String(n), label: String(n) } }));
    const edges = es.map((e, idx) => ({
      data: {
        id: `e${idx}-${String(e.u)}-${String(e.v)}`,
        source: String(e.u),
        target: String(e.v),
        label: weighted && e.w != null ? String(e.w) : "",
      },
    }));
    return [...nodes, ...edges];
  }, [nodesText, edgesText, weighted]);

  const cyStyle = useMemo(
    () => ({
      height: "520px",
      width: "100%",
      borderRadius: "1rem",
    }),
    []
  );

  // Visual styles
  const stylesheet = useMemo(
  () => [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-valign": "center",
        "background-color": "#94a3b8",
        color: "#0f172a",
        "font-weight": 600,
      },
    },
    {
      selector: "edge",
      style: {
        width: 3,
        "line-color": "#cbd5e1",
        "target-arrow-color": "#cbd5e1",
        "curve-style": "bezier",
        label: "data(label)",
        "text-margin-y": -10,
      },
    },
    // 👇 include doar când e directed
    ...(directed
      ? [{ selector: "edge", style: { "target-arrow-shape": "triangle" } }]
      : []),
    { selector: ".visited", style: { "background-color": "#22c55e" } },
    { selector: ".current", style: { "background-color": "#f59e0b" } },
    {
      selector: ".discover",
      style: {
        "line-color": "#38bdf8",
        "target-arrow-color": "#38bdf8",
        width: 5,
      },
    },
  ],
  [directed]
);

  // Apply classes based on state after each step
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("visited current");
    cy.edges().removeClass("discover");

    visited.forEach((v) => cy.$id(String(v)).addClass("visited"));
    if (currentNode != null) cy.$id(String(currentNode)).addClass("current");

    // highlight edges that were recently discovered in last log item
    const last = log[log.length - 1];
    if (last && last.type === "discover_edge") {
      const { u, v } = last.data as any;
      const eid = `edge[source = '${String(u)}'][target = '${String(v)}']`;
      cy.edges(eid).addClass("discover");
      if (!directed) {
        const eid2 = `edge[source = '${String(v)}'][target = '${String(u)}']`;
        cy.edges(eid2).addClass("discover");
      }
    }
  }, [visited, currentNode, log, directed]);

  async function createSession() {
    setEnded(false);
    setLog([]);
    setVisited([]);
    setQueue([]);
    setPQ([]);
    setDist({});
    setPrevMap({});

    const graph: GraphIn = {
      directed,
      weighted,
      nodes: parseNodes(nodesText),
      edges: parseEdges(edgesText),
    };

    const params = new URLSearchParams({ algo, start: startNode });
    const res = await fetch(`${API_BASE}/sessions?${params.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(graph),
    });

    if (!res.ok) {
      const msg = await res.text();
      alert(`Failed to create session: ${msg}`);
      return;
    }
    const data = await res.json();
    setSessionId(data.session_id);
    if (useWS) {
      try { wsRef.current?.close(); } catch {}
        connectWS(data.session_id);
}

  }

  async function doStep() {
  if (!sessionId || ended) return;

  // WebSocket mode
  if (useWS && wsConnected) {
    wsStepOnce();
    return;
  }

  // HTTP fallback
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/step`, { method: "POST" });
  if (!res.ok) {
    const msg = await res.text();
    alert(`Step failed: ${msg}`);
    return;
  }
  const ev: StepEvent = await res.json();
  applyEvent(ev);
}

  useInterval(() => {
    if (running) doStep();
  }, running ? 600 : null);

  useEffect(() => {
  return () => {
    try { wsRef.current?.close(); } catch {}
  };
}, []);


  // Cytoscape layout
  const layout = { name: "cose", animate: false } as any;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">GraphAlgoLab — Frontend</h1>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Controls */}
        <div className="md:col-span-1 space-y-3">
          <div className="p-3 rounded-2xl shadow border">
            <label className="block text-sm font-semibold mb-1">Algorithm</label>
            <select className="w-full border rounded p-2" value={algo} onChange={(e) => setAlgo(e.target.value as any)}>
              <option value="bfs">BFS</option>
              <option value="dfs">DFS</option>
              <option value="dijkstra">Dijkstra</option>
            </select>
          </div>

          <div className="p-3 rounded-2xl shadow border grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={directed} onChange={(e) => setDirected(e.target.checked)} /> Directed</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} /> Weighted</label>
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1">Start node</label>
              <input className="w-full border rounded p-2" value={startNode} onChange={(e) => setStartNode(e.target.value)} />
            </div>
          </div>

          <div className="p-3 rounded-2xl shadow border">
            <label className="block text-sm font-semibold mb-1">Nodes (comma/space separated)</label>
            <textarea className="w-full border rounded p-2 h-16" value={nodesText} onChange={(e) => setNodesText(e.target.value)} />
          </div>

          <div className="p-3 rounded-2xl shadow border">
            <label className="block text-sm font-semibold mb-1">Edges (one per line: u v [w])</label>
            <textarea className="w-full border rounded p-2 h-24" value={edgesText} onChange={(e) => setEdgesText(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-2xl bg-black text-white" onClick={createSession}>Create session</button>
            <button className="px-3 py-2 rounded-2xl bg-gray-800 text-white disabled:opacity-50" onClick={doStep} disabled={!sessionId || ended}>Step</button>
            <button className="px-3 py-2 rounded-2xl bg-gray-200" onClick={() => setRunning((r) => !r)} disabled={!sessionId || ended}>{running ? "Pause" : "Auto"}</button>
          </div>

          <div className="text-sm opacity-70">Session: {sessionId ?? "-"}</div>
        </div>

        {/* Graph */}
        <div className="md:col-span-2">
          <CytoscapeComponent
          cy={(inst: cytoscape.Core) => { cyRef.current = inst; }}   // ✅
          elements={elements as any}
          style={cyStyle}
          stylesheet={stylesheet as any}
          layout={layout}
        />
        </div>
      </div>

      {/* State Panels */}
      <div className="grid md:grid-cols-3 gap-4 mt-4">
        <div className="p-3 rounded-2xl shadow border">
          <div className="font-semibold mb-2">Visited</div>
          <div className="text-sm break-words">{visited.join(", ") || "-"}</div>
        </div>
        <div className="p-3 rounded-2xl shadow border">
          <div className="font-semibold mb-2">Queue / Stack</div>
          <div className="text-sm break-words">{queue.join(", ") || "-"}</div>
        </div>
        <div className="p-3 rounded-2xl shadow border">
          <div className="font-semibold mb-2">Priority Queue / Dist (Dijkstra)</div>
          <div className="text-xs">
            {Object.keys(dist).length === 0 ? (
              <div>-</div>
            ) : (
              <pre className="whitespace-pre-wrap">{JSON.stringify(dist, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>

      {/* Log */}
      <div className="mt-4 p-3 rounded-2xl shadow border">
        <div className="font-semibold mb-2">Event Log</div>
        <div className="text-xs max-h-60 overflow-auto">
          {log.map((ev, i) => (
            <div key={i} className="border-b py-1">
              <span className="font-semibold">{ev.type}</span> — <code>{JSON.stringify(ev.data)}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
