import type { Workflow } from "../engine/types";

export const initialWorkflow: Workflow = {
  id: "lead-enrichment",
  version: 1,
  nodes: {
    start: {
      id: "start",
      type: "start",
      label: "New lead received",
      position: { x: 70, y: 190 },
      outputs: [{ id: "next", label: "Next" }],
    },
    enrich: {
      id: "enrich",
      type: "action",
      label: "Enrich lead data",
      position: { x: 390, y: 190 },
      inputs: [{ id: "input", label: "Input" }],
      outputs: [{ id: "next", label: "Next" }],
      config: { action: "Fetch company details" },
    },
    qualify: {
      id: "qualify",
      type: "condition",
      label: "Is lead qualified?",
      position: { x: 710, y: 190 },
      inputs: [{ id: "input", label: "Input" }],
      outputs: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
      config: { expression: "score >= 70" },
    },
    success: {
      id: "success",
      type: "end",
      label: "Send to sales",
      position: { x: 1040, y: 100 },
      inputs: [{ id: "input", label: "Input" }],
    },
    fallback: {
      id: "fallback",
      type: "end",
      label: "Add to nurture",
      position: { x: 1040, y: 300 },
      inputs: [{ id: "input", label: "Input" }],
    },
  },
  edges: {
    "edge-start-enrich": {
      id: "edge-start-enrich",
      source: { nodeId: "start", portId: "next" },
      target: { nodeId: "enrich", portId: "input" },
    },
    "edge-enrich-qualify": {
      id: "edge-enrich-qualify",
      source: { nodeId: "enrich", portId: "next" },
      target: { nodeId: "qualify", portId: "input" },
    },
    "edge-qualify-yes": {
      id: "edge-qualify-yes",
      source: { nodeId: "qualify", portId: "yes" },
      target: { nodeId: "success", portId: "input" },
    },
    "edge-qualify-no": {
      id: "edge-qualify-no",
      source: { nodeId: "qualify", portId: "no" },
      target: { nodeId: "fallback", portId: "input" },
    },
  },
};
