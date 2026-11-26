import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent } from "react";
import type { Point, WorkflowEdge, WorkflowNode } from "./engine/types";
import { initialWorkflow } from "./editor/initialWorkflow";
import { addEdge, addNode, duplicateWorkflow, moveNode, removeEdge, removeNode, updateNode, updateWorkflowMetadata } from "./engine/operations";
import { commitHistory, createHistory, redoHistory, undoHistory } from "./engine/history";
import { deserializeWorkflow, serializeWorkflow } from "./engine/serialization";
import { createWorkflowStorage } from "./engine/storage";
import { validateWorkflow } from "./engine/validation";
import type { WorkflowValidationIssue } from "./engine/validation";
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
  onConnectStart,
  onConnectActivate,
  onConnectTarget,
  onMoveBy,
  connectionTarget,
}: {
  node: WorkflowNode;
  selected: boolean;
  connectionTarget: boolean;
  onSelect: () => void;
  onDragStart: (event: PointerEvent<HTMLDivElement>) => void;
  onConnectStart: (portId: string, event: PointerEvent<HTMLButtonElement>) => void;
  onConnectActivate: (portId: string) => void;
  onConnectTarget: (portId: string) => void;
  onMoveBy: (deltaX: number, deltaY: number) => void;
}) {
  return (
    <div
      className={`graph-node ${selected ? "is-selected" : ""}`}
      style={{ left: node.position.x, top: node.position.y }}
      onClick={onSelect}
      onFocus={onSelect}
      onPointerDown={onDragStart}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 1 : 10;
        const movement: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
        const delta = movement[event.key];
        if (delta) { event.preventDefault(); event.stopPropagation(); onMoveBy(delta[0], delta[1]); }
      }}
      role="group" tabIndex={0}
      aria-label={`Node ${node.label}, ${node.type} node. Use arrow keys to move.`}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
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
        <button key={port.id} type="button" className={`graph-port graph-port-input ${connectionTarget ? "is-drop-target" : ""}`} data-port-direction="input" data-node-id={node.id} data-port-id={port.id} style={{ top: portOffset(node, port.id, "input") }} title={port.label} aria-label={`Connect to ${node.label}, ${port.label} input`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onConnectTarget(port.id); }} />
      ))}
      {outputPorts(node).map((port) => (
        <button key={port.id} type="button" className="graph-port graph-port-output" data-port-direction="output" data-node-id={node.id} data-port-id={port.id} onPointerDown={(event) => onConnectStart(port.id, event)} onClick={(event) => { event.stopPropagation(); if (event.detail === 0) onConnectActivate(port.id); }} style={{ top: portOffset(node, port.id, "output") }} title={`Connect from ${port.label}`} aria-label={`Start connection from ${node.label}, ${port.label} output`} />
      ))}
      {node.type === "condition" && <div className="condition-labels"><span>Yes</span><span>No</span></div>}
    </div>
  );
}

export default function App() {
  const [workflow, setWorkflowState] = useState(initialWorkflow);
  const [history, setHistory] = useState(() => createHistory(initialWorkflow));
  const workflowRef = useRef(workflow);
  const storageRef = useRef<ReturnType<typeof createWorkflowStorage> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  workflowRef.current = workflow;

  const commitWorkflow = (nextWorkflow: typeof initialWorkflow) => {
    workflowRef.current = nextWorkflow;
    setWorkflowState(nextWorkflow);
    setHistory((current) => commitHistory(current, nextWorkflow));
    setIsDirty(true);
  };
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ zoom: 0.78, panX: 0, panY: 0 });
  const [connectionDraft, setConnectionDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [connectionTargetId, setConnectionTargetId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isDirty, setIsDirty] = useState(true);
  const [validationIssues, setValidationIssues] = useState<WorkflowValidationIssue[] | null>(null);
  const connectionRef = useRef<{ pointerId: number; sourceNodeId: string; sourcePortId: string } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
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

  const handleNodeDragStart = (node: WorkflowNode, event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
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

  const handleConnectStart = (node: WorkflowNode, portId: string, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = node.position.x + 220;
    const startY = node.position.y + portOffset(node, portId, "output");
    connectionRef.current = {
      pointerId: event.pointerId,
      sourceNodeId: node.id,
      sourcePortId: portId,
    };
    setConnectionDraft({ x1: startX, y1: startY, x2: startX, y2: startY });
    setConnectionTargetId(null);
    setNotice("Drag to an input port to create a connection");
    viewportRef.current?.setPointerCapture(event.pointerId);
  };

  const handleKeyboardConnectStart = (node: WorkflowNode, portId: string) => {
    const x = node.position.x + 220;
    const y = node.position.y + portOffset(node, portId, "output");
    connectionRef.current = { pointerId: -1, sourceNodeId: node.id, sourcePortId: portId };
    setConnectionDraft({ x1: x, y1: y, x2: x, y2: y });
    setConnectionTargetId(null);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setNotice("Choose an input port to complete the connection. Press Escape to cancel.");
  };

  const handleConnectToPort = (node: WorkflowNode, portId: string) => {
    const connection = connectionRef.current;
    if (!connection || connection.pointerId !== -1) return;
    try {
      commitWorkflow(addEdge(workflowRef.current, {
        id: `edge-${crypto.randomUUID().slice(0, 8)}`,
        source: { nodeId: connection.sourceNodeId, portId: connection.sourcePortId },
        target: { nodeId: node.id, portId },
      }));
      setNotice("Connection created");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create connection");
    } finally {
      connectionRef.current = null; setConnectionDraft(null); setConnectionTargetId(null);
    }
  };

  const handleCanvasPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || dragRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest(".graph-node, .graph-edge, .graph-port")) return;

    panRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: viewport.panX,
      startPanY: viewport.panY,
    };
    viewportRef.current?.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const connection = connectionRef.current;
    if (connection && connection.pointerId === event.pointerId && graphWorldRef.current) {
      const bounds = graphWorldRef.current.getBoundingClientRect();
      const scale = bounds.width / 1320 || 1;
      setConnectionDraft((draft) => draft ? { ...draft, x2: (event.clientX - bounds.left) / scale, y2: (event.clientY - bounds.top) / scale } : draft);
      const hovered = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-port-direction="input"]');
      const hoveredNodeId = hovered?.dataset.nodeId ?? null;
      setConnectionTargetId((current) => current === hoveredNodeId ? current : hoveredNodeId);
      setNotice(hoveredNodeId ? `Release to connect to ${workflowRef.current.nodes[hoveredNodeId]?.label ?? "input"}` : "Drop on an input port to connect");
      return;
    }

    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const worldWidth = graphWorldRef.current?.getBoundingClientRect().width ?? 1320;
      const scale = worldWidth / 1320 || 1;
      const x = Math.max(0, drag.startX + (event.clientX - drag.startClientX) / scale);
      const y = Math.max(0, drag.startY + (event.clientY - drag.startClientY) / scale);
      const nextWorkflow = moveNode(workflowRef.current, drag.nodeId, { x, y });
      workflowRef.current = nextWorkflow;
      setWorkflowState(nextWorkflow);
      return;
    }

    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setViewport((current) => ({
      ...current,
      panX: pan.startPanX + event.clientX - pan.startClientX,
      panY: pan.startPanY + event.clientY - pan.startClientY,
    }));
  };

  const changeZoom = (delta: number) => {
    setViewport((current) => ({
      ...current,
      zoom: Math.min(1.35, Math.max(0.45, Number((current.zoom + delta).toFixed(2)))),
    }));
  };

  const fitCanvas = () => setViewport({ zoom: 0.68, panX: 0, panY: 0 });

  const handleAddNode = (type: WorkflowNode["type"]) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 8)}`;
    const position = {
      x: 160 + (nodes.length % 3) * 70,
      y: 430 + (Math.floor(nodes.length / 3) % 3) * 36,
    };
    const node = createWorkflowNode(type, id, position);
    commitWorkflow(addNode(workflowRef.current, node));
    setSelectedNodeId(id);
  };

  const handleCanvasPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const connection = connectionRef.current;
    if (connection && connection.pointerId === event.pointerId) {
      const target = event.type === "pointercancel" ? null : document.elementFromPoint(event.clientX, event.clientY);
      const inputPort = target?.closest<HTMLElement>('[data-port-direction="input"]');
      const targetNodeId = inputPort?.dataset.nodeId;
      const targetPortId = inputPort?.dataset.portId;

      if (targetNodeId && targetPortId) {
        const edge = {
          id: `edge-${crypto.randomUUID().slice(0, 8)}`,
          source: { nodeId: connection.sourceNodeId, portId: connection.sourcePortId },
          target: { nodeId: targetNodeId, portId: targetPortId },
        };
        try {
          commitWorkflow(addEdge(workflowRef.current, edge));
          setNotice("Connection created");
        } catch (error) {
          setNotice(error instanceof Error ? error.message : "Unable to create connection");
        }
      } else {
        setNotice("Connection cancelled — drop on an input port");
      }

      connectionRef.current = null;
      setConnectionDraft(null);
      setConnectionTargetId(null);
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      setHistory((current) => commitHistory(current, workflowRef.current));
      dragRef.current = null;
    }
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
    }
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) {
      viewportRef.current.releasePointerCapture(event.pointerId);
    }
  };
  const selectedNode = selectedNodeId ? workflow.nodes[selectedNodeId] : undefined;
  const selectedEdge = selectedEdgeId ? workflow.edges[selectedEdgeId] : undefined;
  const nodes = Object.values(workflow.nodes);
  const edges = Object.values(workflow.edges);

  const updateSelectedNode = (updater: (node: WorkflowNode) => WorkflowNode) => {
    if (!selectedNodeId) return;
    commitWorkflow(updateNode(workflowRef.current, selectedNodeId, updater));
  };

  const handleDeleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    commitWorkflow(removeEdge(workflowRef.current, selectedEdgeId));
    setSelectedEdgeId(null);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    const deletedLabel = workflowRef.current.nodes[selectedNodeId]?.label ?? "Node";
    commitWorkflow(removeNode(workflowRef.current, selectedNodeId));
    setSelectedNodeId(null); setSelectedEdgeId(null);
    setNotice(`${deletedLabel} deleted`);
    viewportRef.current?.focus();
  };

  const handleDuplicateWorkflow = () => {
    const current = workflowRef.current;
    const duplicate = duplicateWorkflow(current, `${current.id}-copy-${crypto.randomUUID().slice(0, 6)}`);
    workflowRef.current = duplicate;
    setWorkflowState(duplicate);
    setHistory(createHistory(duplicate));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setValidationIssues(null);
    setIsDirty(true);
    setNotice("Workflow duplicated. Save to keep this copy in this browser.");
  };

  const handleUndo = () => {
    const nextHistory = undoHistory(history);
    setHistory(nextHistory);
    workflowRef.current = nextHistory.present;
    setWorkflowState(nextHistory.present);
    setIsDirty(true);
  };

  const handleRedo = () => {
    const nextHistory = redoHistory(history);
    setHistory(nextHistory);
    workflowRef.current = nextHistory.present;
    setWorkflowState(nextHistory.present);
    setIsDirty(true);
  };

  useEffect(() => {
    try {
      storageRef.current = createWorkflowStorage(window.localStorage);
      const savedWorkflow = storageRef.current.load();
      if (savedWorkflow) {
        workflowRef.current = savedWorkflow;
        setWorkflowState(savedWorkflow);
        setHistory(createHistory(savedWorkflow));
        setIsDirty(false);
        setNotice("Loaded your saved workflow");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load saved workflow");
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditingText = target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

      if (!isEditingText && event.key === "Escape" && connectionRef.current?.pointerId === -1) {
        connectionRef.current = null; setConnectionDraft(null); setConnectionTargetId(null); setNotice("Connection cancelled"); return;
      }

      if (!isEditingText && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (!isEditingText && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (!isEditingText && (event.key === "Backspace" || event.key === "Delete") && (selectedNodeId || selectedEdgeId)) {
        event.preventDefault();
        if (selectedNodeId) handleDeleteSelectedNode();
        else if (selectedEdgeId) handleDeleteSelectedEdge();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, selectedNodeId, selectedEdgeId]);

  const handleValidate = () => {
    const result = validateWorkflow(workflowRef.current);
    setValidationIssues(result.issues);
    setNotice(result.valid ? "Workflow is valid" : `${result.issues.length} validation issue(s) found`);
  };

  const handleSave = () => {
    try {
      storageRef.current?.save(workflowRef.current);
      setIsDirty(false);
      setNotice("Workflow saved in this browser");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save workflow");
    }
  };

  const handleExport = () => {
    const json = serializeWorkflow(workflowRef.current);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workflowRef.current.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Workflow JSON exported");
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imported = deserializeWorkflow(await file.text());
      workflowRef.current = imported;
      setWorkflowState(imported);
      setHistory(createHistory(imported));
      setIsDirty(true);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setNotice("Workflow imported successfully");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to import workflow");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <BrandMark />
          <span className="brand-name">flow<span>studio</span></span>
          <span className="topbar-divider" />
          <span className="workflow-name">{workflow.name || workflow.id} <span>⌄</span></span>
          <span className={`saved-state ${isDirty ? "is-dirty" : ""}`}><i /> {isDirty ? "Unsaved changes" : "Saved locally"}</span>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={handleUndo} disabled={history.past.length === 0} aria-label="Undo" title="Undo (⌘Z)">↶</button>
          <button className="icon-button" onClick={handleRedo} disabled={history.future.length === 0} aria-label="Redo" title="Redo (⌘⇧Z)">↷</button>
          <span className="topbar-divider" />
          <button className="share-button" type="button" onClick={handleDuplicateWorkflow}>Duplicate</button>
          <button className="share-button" type="button" onClick={() => importInputRef.current?.click()}>Import</button>
          <button className="share-button" type="button" onClick={handleExport}>Export</button>
          <button className="publish-button" type="button" onClick={handleSave}>Save</button>
          <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={handleImportFile} />
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
            <div className="breadcrumb"><span>Workflows</span><b>/</b><strong>{workflow.name || workflow.id}</strong></div>
            <button className="validate-button" type="button" onClick={handleValidate}>✓ Validate</button>
            <div className="canvas-tools"><button disabled title="Select">↖</button><button disabled title="Pan">✋</button><span /><button onClick={() => changeZoom(-0.1)} title="Zoom out">−</button><small>{Math.round(viewport.zoom * 100)}%</small><button onClick={() => changeZoom(0.1)} title="Zoom in">+</button><span /><button onClick={fitCanvas} title="Fit view">⛶</button></div>
          </div>
          <div
            className="canvas-viewport"
            ref={viewportRef}
            role="region"
            aria-label="Workflow canvas. Focus a node and use arrow keys to move it. Use output and input controls to connect nodes."
            tabIndex={-1}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
          >
            <div className="canvas-grid" />
            <div className="canvas-empty-hint"><span>✦</span> Workflow canvas <em>·</em> Drag nodes to move · Drag output ports to connect</div>
            {notice && <div className="canvas-notice" role="status" aria-live="polite" aria-atomic="true">{notice}</div>}
            {validationIssues !== null && (
              <div className="validation-panel" role="status">
                <div className="validation-panel-heading">
                  <strong>{validationIssues.length === 0 ? "Workflow is valid" : `Validation issues · ${validationIssues.length}`}</strong>
                  <button type="button" onClick={() => setValidationIssues(null)} aria-label="Close validation results">×</button>
                </div>
                {validationIssues.length === 0 ? (
                  <p className="validation-success">All graph integrity checks passed.</p>
                ) : (
                  <ul>
                    {validationIssues.map((issue, index) => (
                      <li key={`${issue.code}-${issue.path}-${index}`}>
                        <span>{issue.message}</span>
                        <small>{issue.path}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="graph-world" ref={graphWorldRef} style={{ transform: `translate(calc(-50% + ${viewport.panX}px), calc(-50% + ${viewport.panY}px)) scale(${viewport.zoom})` }}>
              <svg className="edge-layer" width="1320" height="620" role="group" aria-label="Workflow connections">
                {edges.map((edge) => <path key={edge.id} d={edgePath(edge, workflow.nodes)} className={`graph-edge ${selectedEdgeId === edge.id ? "is-selected" : ""}`} onClick={(event) => { event.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }} role="button" tabIndex={0} aria-label={`Connection from ${edge.source.nodeId} to ${edge.target.nodeId}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); } }} />)}
                {connectionDraft && <path d={`M ${connectionDraft.x1} ${connectionDraft.y1} C ${connectionDraft.x1 + 60} ${connectionDraft.y1}, ${connectionDraft.x2 - 60} ${connectionDraft.y2}, ${connectionDraft.x2} ${connectionDraft.y2}`} className="graph-edge graph-edge-draft" />}
              </svg>
              {nodes.map((node) => (
                <NodeCard key={node.id} node={node} selected={selectedNodeId === node.id} connectionTarget={connectionTargetId === node.id} onSelect={() => { setSelectedNodeId(node.id); setSelectedEdgeId(null); }} onDragStart={(event) => handleNodeDragStart(node, event)} onConnectStart={(portId, event) => handleConnectStart(node, portId, event)} onConnectActivate={(portId) => handleKeyboardConnectStart(node, portId)} onConnectTarget={(portId) => handleConnectToPort(node, portId)} onMoveBy={(dx, dy) => commitWorkflow(moveNode(workflowRef.current, node.id, { x: Math.max(0, node.position.x + dx), y: Math.max(0, node.position.y + dy) }))} />
              ))}
            </div>
            <div className="canvas-zoom"><button onClick={() => changeZoom(-0.1)} aria-label="Zoom out">−</button><span>{Math.round(viewport.zoom * 100)}%</span><button onClick={() => changeZoom(0.1)} aria-label="Zoom in">+</button><i /><button onClick={fitCanvas} aria-label="Fit view">⌗</button></div>
          </div>
          <div className="canvas-status"><span>{nodes.length} nodes</span><i /> <span>{edges.length} connections</span><span className="canvas-coords">Graph v{workflow.version}</span></div>
        </section>

        <aside className="right-panel">
          <div className="inspector-heading"><div><span className="eyebrow">CONFIGURE</span><h2>Inspector</h2></div><button className="small-icon" disabled>›</button></div>
          {selectedNode ? (
            <div className="selected-inspector">
              <div className="selected-node-type"><span className={`node-symbol ${nodeTone(selectedNode)}`}>{nodeIcon(selectedNode)}</span><div><strong>{selectedNode.label}</strong><small>{selectedNode.type.toUpperCase()} NODE</small></div></div>
              <label>Node ID</label><div className="fake-input">{selectedNode.id}</div>
              <label htmlFor="node-label">Label</label><input id="node-label" className="inspector-input" value={selectedNode.label} onChange={(event) => updateSelectedNode((node) => ({ ...node, label: event.target.value }))} />
              <label>Position</label><div className="position-fields"><div><small>X</small><strong>{selectedNode.position.x}</strong></div><div><small>Y</small><strong>{selectedNode.position.y}</strong></div></div>
              {selectedNode.type === "action" && <><label htmlFor="node-action">Action</label><input id="node-action" className="inspector-input" value={selectedNode.config.action} onChange={(event) => updateSelectedNode((node) => node.type === "action" ? { ...node, config: { action: event.target.value } } : node)} /></>}
              {selectedNode.type === "condition" && <><label htmlFor="node-expression">Expression</label><input id="node-expression" className="inspector-input" value={selectedNode.config.expression} onChange={(event) => updateSelectedNode((node) => node.type === "condition" ? { ...node, config: { expression: event.target.value } } : node)} /></>}
              <button className="delete-node-button" type="button" onClick={handleDeleteSelectedNode}>Delete node</button>
            </div>
          ) : selectedEdge ? (
            <div className="selected-inspector">
              <div className="selected-node-type"><span className="node-symbol blue">↔</span><div><strong>Connection</strong><small>WORKFLOW EDGE</small></div></div>
              <label>Connection ID</label><div className="fake-input">{selectedEdge.id}</div>
              <label>Source</label><div className="fake-input">{selectedEdge.source.nodeId} · {selectedEdge.source.portId}</div>
              <label>Target</label><div className="fake-input">{selectedEdge.target.nodeId} · {selectedEdge.target.portId}</div>
              <button className="delete-node-button" type="button" onClick={handleDeleteSelectedEdge}>Delete connection</button>
            </div>
          ) : (
            <div className="inspector-empty"><div className="inspector-art"><span>◇</span><i /><b /></div><strong>Nothing selected</strong><p>Select a node on the canvas to view its properties.</p></div>
          )}
          <div className="inspector-bottom">
            <div className="section-label">WORKFLOW DETAILS</div>
            <label htmlFor="workflow-name">Workflow name</label>
            <input id="workflow-name" className="inspector-input" value={workflow.name ?? ""} placeholder="Untitled workflow" onChange={(event) => commitWorkflow(updateWorkflowMetadata(workflowRef.current, { name: event.target.value }))} />
            <label htmlFor="workflow-description">Description</label>
            <textarea id="workflow-description" className="inspector-textarea" value={workflow.description ?? ""} placeholder="Add a short description..." onChange={(event) => commitWorkflow(updateWorkflowMetadata(workflowRef.current, { description: event.target.value }))} />
            <div className="metadata-row"><span>Nodes</span><strong>{nodes.length}</strong></div>
            <div className="metadata-row"><span>Connections</span><strong>{edges.length}</strong></div>
          </div>
        </aside>
      </div>
      <footer className="app-footer"><span><i /> Graph loaded</span><span>Flow Studio <b>·</b> A visual workflow editor</span><span>⌘ + K <b>Shortcuts</b></span></footer>
    </main>
  );
}
