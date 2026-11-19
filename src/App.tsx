import "./styles.css";

const palette = [
  { icon: "↗", name: "Start", detail: "Entry point", tone: "mint" },
  { icon: "⚡", name: "Action", detail: "Run a task", tone: "blue" },
  { icon: "◇", name: "Condition", detail: "Branch logic", tone: "amber" },
  { icon: "■", name: "End", detail: "Finish flow", tone: "rose" },
];

function BrandMark() {
  return <div className="brand-mark"><span /><span /><span /></div>;
}

export default function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <BrandMark />
          <span className="brand-name">flow<span>studio</span></span>
          <span className="topbar-divider" />
          <button className="workflow-name">Untitled workflow <span>⌄</span></button>
          <span className="saved-state"><i /> All changes saved</span>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="Undo" title="Undo">↶</button>
          <button className="icon-button" aria-label="Redo" title="Redo">↷</button>
          <span className="topbar-divider" />
          <button className="share-button">Share</button>
          <button className="publish-button">Publish <span>↗</span></button>
          <div className="avatar">S</div>
        </div>
      </header>

      <div className="workspace">
        <aside className="left-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">BUILD</span><h2>Node library</h2></div>
            <button className="small-icon" aria-label="Collapse panel">‹</button>
          </div>
          <div className="search-box"><span>⌕</span><span>Search nodes</span><kbd>⌘ K</kbd></div>
          <div className="library-section">
            <div className="section-label">BASICS <span>−</span></div>
            {palette.map((item) => (
              <div className="palette-item" key={item.name}>
                <div className={`palette-icon ${item.tone}`}>{item.icon}</div>
                <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                <span className="drag-handle">⠿</span>
              </div>
            ))}
          </div>
          <div className="panel-tip"><span>✦</span><div><strong>Quick tip</strong><p>Drag a node onto the canvas to start building your workflow.</p></div></div>
          <div className="left-footer"><span className="status-dot" /> Engine ready <span className="version">v0.1.0</span></div>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div className="breadcrumb"><span>Workflows</span><b>/</b><strong>Untitled workflow</strong></div>
            <div className="canvas-tools"><button title="Select">↖</button><button title="Hand">✋</button><span /><button title="Zoom out">−</button><small>100%</small><button title="Zoom in">+</button><span /><button title="Fit view">⛶</button></div>
          </div>
          <div className="canvas-viewport">
            <div className="canvas-grid" />
            <div className="canvas-empty-hint"><span>✦</span> Your workflow canvas</div>
            <div className="sample-flow">
              <div className="flow-node start-node">
                <div className="node-top"><span className="node-symbol mint">↗</span><span className="node-kind">TRIGGER</span><span className="node-menu">···</span></div>
                <strong>New lead received</strong><small>Workflow starts here</small>
                <div className="node-port output-port"><i /> <span>Start</span></div>
              </div>
              <div className="flow-edge edge-one"><span /></div>
              <div className="flow-node action-node">
                <div className="node-top"><span className="node-symbol blue">⚡</span><span className="node-kind">ACTION</span><span className="node-menu">···</span></div>
                <strong>Enrich lead data</strong><small>Fetch company details</small>
                <div className="node-port input-port"><i /></div><div className="node-port output-port"><i /></div>
              </div>
              <div className="flow-edge edge-two"><span /></div>
              <div className="flow-node condition-node">
                <div className="node-top"><span className="node-symbol amber">◇</span><span className="node-kind">CONDITION</span><span className="node-menu">···</span></div>
                <strong>Is lead qualified?</strong><small>Score ≥ 70</small>
                <div className="node-port input-port"><i /></div>
                <div className="branch-label yes">Yes</div><div className="branch-label no">No</div>
                <div className="node-port output-port"><i /></div>
              </div>
            </div>
            <div className="canvas-zoom"><button>−</button><span>100%</span><button>+</button><i /><button>⌗</button></div>
          </div>
          <div className="canvas-status"><span>3 nodes</span><i /> <span>2 connections</span><span className="canvas-coords">X: 240&nbsp;&nbsp; Y: 180</span></div>
        </section>

        <aside className="right-panel">
          <div className="inspector-heading"><div><span className="eyebrow">CONFIGURE</span><h2>Inspector</h2></div><button className="small-icon">›</button></div>
          <div className="inspector-empty"><div className="inspector-art"><span>◇</span><i /><b /></div><strong>Nothing selected</strong><p>Select a node on the canvas to view and edit its properties.</p></div>
          <div className="inspector-bottom"><div className="section-label">WORKFLOW DETAILS</div><label>Workflow name</label><div className="fake-input">Untitled workflow</div><label>Description</label><div className="fake-textarea">Add a short description...</div><div className="metadata-row"><span>Version</span><strong>1</strong></div><div className="metadata-row"><span>Last edited</span><strong>Just now</strong></div></div>
        </aside>
      </div>
      <footer className="app-footer"><span><i /> Ready to build</span><span>Flow Studio <b>·</b> A visual workflow editor</span><span>⌘ + K <b>Shortcuts</b></span></footer>
    </main>
  );
}
