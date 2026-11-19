import { useRef, useState } from "react";
import type { PointerEvent } from "react";
import type { Point, WorkflowEdge, WorkflowNode } from "./engine/types";
import { initialWorkflow } from "./editor/initialWorkflow";
import { addNode, moveNode } from "./engine/operations";
import "./styles.css";

const palette = [
  { icon: "↗", name: "Start", detail: "Entry point", tone: "mint", type: "start" as const },
  { icon: "⚡", name: "Action", detail: "Run a task", tone: "blue", type: "action" as const },
  { icon: "◇", name: "Condition", detail: "Branch logic", tone: "amber", type: "condition" as const },
  { icon: "■", name: "End", detail: "Finish flow", tone: "rose", type: "end" as const },
];

function createWorkflowNode(type: WorkflowNode["type"], id: string, position: Point): WorkflowNode {
  const base = { id, position, label: type === "start" ? "Start" : type === "action" ? "New action" : type === "condition" ? "New condition" : "End" };

  switch (type) {
    case "start":
      return { ...base, type, outputs: [{ id: "next", label: "Next" }] };
    case "action":
      return {
        ...base,
        type,
        inputs: [{ id: "input", label: "Input" }],
        outputs: [{ id: "next", label: "Next" }],
        config: { action: "Configure action" },
      };
    case "condition":
      return {
        ...base,
        type,
        inputs: [{ id: "input", label: "Input" }],
        outputs: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
        config: { expression: "true" },
      };
    case "end":
      return { ...base, type, inputs: [{ id: "input", label: "Input" }] };
  }
}

function BrandMark() {
  return <div className="brand-mark"><span /><span /><span /></div>;
}

function nodeTone(node: WorkflowNode) {
  return node.type === "start" ? "mint" : node.type === "action" ? "blue" : node.type === "condition" ? "amber" : "rose";
}

function nodeIcon(node: WorkflowNode) {
  return node.type === "start" ? "↗" : node.type === "action" ? "⚡" : node.type === "condition" ? "◇" : "■";
}

function inputPorts(node: WorkflowNode) {
  return "inputs" in node ? node.inputs : [];
}

function outputPorts(node: WorkflowNode) {
  return "outputs" in node ? node.outputs : [];
}

function portOffset(node: WorkflowNode, portId: string, direction: "input" | "output") {
  const ports = direction === "input" ? inputPorts(node) : outputPorts(node);
  const index = ports.findIndex((port) => port.id === portId);
  return ports.length > 1 ? 43 + Math.max(index, 0) * 34 : 60;
}

function edgePath(edge: WorkflowEdge, nodes: Record<string, WorkflowNode>) {
  const source = nodes[edge.source.nodeId];
  const target = nodes[edge.target.nodeId];
  if (!source || !target) return "";

  const sx = source.position.x + 220;
  const sy = source.position.y + portOffset(source, edge.source.portId, "output");
  const tx = target.position.x;
  const ty = target.position.y + portOffset(target, edge.target.portId, "input");
  const curve = Math.max(48, Math.abs(tx - sx) * 0.45);

  return `M ${sx} ${sy} C ${sx + curve} ${sy}, ${tx - curve} ${ty}, ${tx} ${ty}`;
}

function NodeCard({
  node,
  selected,
  onSelect,
  onDragStart,
}: {
  node: WorkflowNode;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className={`graph-node ${selected ? "is-selected" : ""}`}
      style={{ left: node.position.x, top: node.position.y }}
      onClick={onSelect}
      onPointerDown={onDragStart}
      type="button"
      aria-pressed={selected}
    >
      <div className="graph-node-top">
        <span className={`node-symbol ${nodeTone(node)}`}>{nodeIcon(node)}</span>
        <span className="node-kind">{node.type.toUpperCase()}</span>
        <span className="node-menu">···</span>
      </div>
      <strong>{node.label}</strong>
      <small>
        {node.type === "action"
          ? node.config.action
          : node.type === "condition"
            ? node.config.expression
            : node.type === "start"
              ? "Workflow entry point"
              : "Workflow destination"}
      </small>
      {inputPorts(node).map((port) => (
        <span key={port.id} className="graph-port graph-port-input" style={{ top: portOffset(node, port.id, "input") }} title={port.label} />
      ))}
      {outputPorts(node).map((port) => (
        <span key={port.id} className="graph-port graph-port-output" style={{ top: portOffset(node, port.id, "output") }} title={port.label} />
      ))}
      {node.type === "condition" && <div className="condition-labels"><span>Yes</span><span>No</span></div>}
    </button>
  );
}

export default function App() {
  const [workflow, setWorkflow] = useState(initialWorkflow);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const graphWorldRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    nodeId: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const handleNodeDragStart = (node: WorkflowNode, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    dragRef.current = {
      nodeId: node.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: node.position.x,
      startY: node.position.y,
    };
    viewportRef.current?.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const worldWidth = graphWorldRef.current?.getBoundingClientRect().width ?? 1320;
    const scale = worldWidth / 1320 || 1;
    const x = Math.max(0, drag.startX + (event.clientX - drag.startClientX) / scale);
    const y = Math.max(0, drag.startY + (event.clientY - drag.startClientY) / scale);

    setWorkflow((current) => moveNode(current, drag.nodeId, { x, y }));
  };

  const handleAddNode = (type: WorkflowNode["type"]) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
    const position = {
      x: 160 + (nodes.length % 3) * 70,
      y: 430 + (Math.floor(nodes.length / 3) % 3) * 36,
    };
    const node = createWorkflowNode(type, id, position);
    setWorkflow((current) => addNode(current, node));
    setSelectedNodeId(id);
  };

  const handleCanvasPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }
  };
  const selectedNode = selectedNodeId ? workflow.nodes[selectedNodeId] : undefined;
  const nodes = Object.values(workflow.nodes);
  const edges = Object.values(workflow.edges);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <BrandMark />
          <span className="brand-name">flow<span>studio</span></span>
          <span className="topbar-divider" />
          <span className="workflow-name">Lead enrichment <span>⌄</span></span>
          <span className="saved-state"><i /> Example workflow</span>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" disabled aria-label="Undo" title="Undo">↶</button>
          <button className="icon-button" disabled aria-label="Redo" title="Redo">↷</button>
          <span className="topbar-divider" />
          <button className="share-button" disabled>Share</button>
          <button className="publish-button" disabled>Publish <span>↗</span></button>
          <div className="avatar">S</div>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">BUILD</span><h2>Node library</h2></div>
            <button className="small-icon" aria-label="Collapse panel" disabled>‹</button>
          </div>
          <div className="search-box"><span>⌕</span><span>Search nodes</span><kbd>⌘ K</kbd></div>
          <div className="library-section">
            <div className="section-label">BASICS <span>−</span></div>
            {palette.map((item) => (
              <button className="palette-item" key={item.name} type="button" onClick={() => handleAddNode(item.type)}>
                <div className={`palette-icon ${item.tone}`}>{item.icon}</div>
                <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                <span className="drag-handle">＋</span>
              </button>
            ))}
          </div>
          <div className="panel-tip"><span>✦</span><div><strong>Explore the graph</strong><p>Select a node to inspect it, or click a node type to add it to the canvas.</p></div></div>
          <div className="left-footer"><span className="status-dot" /> Graph engine ready <span className="version">v0.1.0</span></div>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div className="breadcrumb"><span>Workflows</span><b>/</b><strong>Lead enrichment</strong></div>
            <div className="canvas-tools"><button disabled title="Select">↖</button><button disabled title="Pan">✋</button><span /><button disabled title="Zoom out">−</button><small>100%</small><button disabled title="Zoom in">+</button><span /><button disabled title="Fit view">⛶</button></div>
          </div>
          <div
            className="canvas-viewport"
            ref={viewportRef}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
          >
            <div className="canvas-grid" />
            <div className="canvas-empty-hint"><span>✦</span> Workflow canvas <em>·</em> Select a node to inspect</div>
            <div className="graph-world" ref={graphWorldRef}>
              <svg className="edge-layer" width="1320" height="620" aria-hidden="true">
                {edges.map((edge) => <path key={edge.id} d={edgePath(edge, workflow.nodes)} className="graph-edge" />)}
              </svg>
              {nodes.map((node) => (
                <NodeCard key={node.id} node={node} selected={selectedNodeId === node.id} onSelect={() => setSelectedNodeId(node.id)} onDragStart={(event) => handleNodeDragStart(node, event)} />
              ))}
            </div>
            <div className="canvas-zoom"><button disabled>−</button><span>100%</span><button disabled>+</button><i /><button disabled>⌗</button></div>
          </div>
          <div className="canvas-status"><span>{nodes.length} nodes</span><i /> <span>{edges.length} connections</span><span className="canvas-coords">Graph v{workflow.version}</span></div>
        </section>

        <aside className="right-panel">
          <div className="inspector-heading"><div><span className="eyebrow">CONFIGURE</span><h2>Inspector</h2></div><button className="small-icon" disabled>›</button></div>
          {selectedNode ? (
            <div className="selected-inspector">
              <div className="selected-node-type"><span className={`node-symbol ${nodeTone(selectedNode)}`}>{nodeIcon(selectedNode)}</span><div><strong>{selectedNode.label}</strong><small>{selectedNode.type.toUpperCase()} NODE</small></div></div>
              <label>Node ID</label><div className="fake-input">{selectedNode.id}</div>
              <label>Label</label><div className="fake-input">{selectedNode.label}</div>
              <label>Position</label><div className="position-fields"><div><small>X</small><strong>{selectedNode.position.x}</strong></div><div><small>Y</small><strong>{selectedNode.position.y}</strong></div></div>
              {selectedNode.type === "action" && <><label>Action</label><div className="fake-input">{selectedNode.config.action}</div></>}
              {selectedNode.type === "condition" && <><label>Expression</label><div className="fake-input">{selectedNode.config.expression}</div></>}
              <div className="inspector-note">Properties are read-only in this milestone.</div>
            </div>
          ) : (
            <div className="inspector-empty"><div className="inspector-art"><span>◇</span><i /><b /></div><strong>Nothing selected</strong><p>Select a node on the canvas to view its properties.</p></div>
          )}
          <div className="inspector-bottom"><div className="section-label">WORKFLOW DETAILS</div><label>Workflow name</label><div className="fake-input">Lead enrichment</div><label>Description</label><div className="fake-textarea">Qualify incoming leads and route them to the right destination.</div><div className="metadata-row"><span>Nodes</span><strong>{nodes.length}</strong></div><div className="metadata-row"><span>Connections</span><strong>{edges.length}</strong></div></div>
        </aside>
      </div>
      <footer className="app-footer"><span><i /> Graph loaded</span><span>Flow Studio <b>·</b> A visual workflow editor</span><span>⌘ + K <b>Shortcuts</b></span></footer>
    </main>
  );
}
