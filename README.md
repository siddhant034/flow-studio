# Flow Studio

A browser-based visual workflow editor for building, connecting, and managing node-based workflows.

## Features

- Typed workflow graph model with Start, Action, Condition, and End nodes
- Immutable graph operations and graph integrity validation
- Drag-and-drop node movement and output-to-input connections
- Canvas panning and zooming
- Node and connection selection, editing, and deletion
- Undo and redo with keyboard shortcuts
- Workflow validation feedback
- Save to browser storage, import JSON, and export JSON

## Getting started

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build the production app |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest suite |

## Architecture

```text
src/
  engine/       Pure TypeScript graph model, operations, validation,
                selectors, history, serialization, and storage
  editor/       Example workflow data and editor-specific composition
  App.tsx       React editor workspace and interactions
  styles.css    Workspace and canvas styling
```

The graph engine is independent of React. The editor uses it as the source of truth for graph mutations, while React handles rendering, pointer interactions, and inspector state.

## Workflow format

Workflows use a normalized representation: nodes and edges are stored in records keyed by their IDs. Edges reference node IDs and port IDs rather than holding references to node objects.

## Current scope

This project is an editor prototype. It does not execute workflows or provide server-side collaboration.

## Deployment

The repository includes a GitHub Pages workflow that builds and deploys the app whenever changes reach `main`.

Before the first deployment, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The published project URL will be:

https://siddhant034.github.io/flow-studio/
