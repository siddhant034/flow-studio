import { describe, expect, it } from "vitest";
import { deserializeWorkflow, serializeWorkflow } from "./serialization";
import type { Workflow } from "./types";

const workflow: Workflow = {
  id: "workflow-1",
  version: 1,
  name: "Lead enrichment",
  description: "Qualify incoming leads",
  nodes: {
    start: {
      id: "start",
      type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      outputs: [{ id: "out", label: "Next" }],
    },
    action: {
      id: "action",
      type: "action",
      label: "Send email",
      position: { x: 240, y: 80 },
      inputs: [{ id: "in", label: "Input" }],
      outputs: [{ id: "out", label: "Output" }],
      config: { action: "send-email" },
    },
    end: {
      id: "end",
      type: "end",
      label: "End",
      position: { x: 480, y: 80 },
      inputs: [{ id: "in", label: "Input" }],
    },
  },
  edges: {
    "edge-1": {
      id: "edge-1",
      source: { nodeId: "start", portId: "out" },
      target: { nodeId: "action", portId: "in" },
    },
    "edge-2": {
      id: "edge-2",
      source: { nodeId: "action", portId: "out" },
      target: { nodeId: "end", portId: "in" },
    },
  },
};

describe("workflow serialization", () => {
  it("serializes and deserializes a workflow", () => {
    const serialized = serializeWorkflow(workflow);

    expect(deserializeWorkflow(serialized)).toEqual(workflow);
  });

  it("produces readable JSON", () => {
    expect(serializeWorkflow(workflow)).toContain('\n  "nodes"');
  });

  it("rejects malformed JSON", () => {
    expect(() => deserializeWorkflow("{not-json")).toThrow(
      "Workflow data is not valid JSON.",
    );
  });

  it("rejects an unsupported schema shape", () => {
    expect(() => deserializeWorkflow(JSON.stringify({ id: "workflow-1" }))).toThrow(
      "Workflow data does not match the supported schema.",
    );
  });

  it("rejects workflows with graph integrity errors", () => {
    const invalid: Workflow = {
      ...workflow,
      edges: {
        broken: {
          id: "broken",
          source: { nodeId: "missing", portId: "out" },
          target: { nodeId: "end", portId: "in" },
        },
      },
    };

    expect(() => deserializeWorkflow(JSON.stringify(invalid))).toThrow(
      "Workflow data is invalid:",
    );
  });

  it("does not silently accept unsupported node types", () => {
    const invalid = {
      ...workflow,
      nodes: {
        ...workflow.nodes,
        custom: {
          id: "custom",
          type: "unknown",
          label: "Unknown",
          position: { x: 0, y: 0 },
        },
      },
    };

    expect(() => deserializeWorkflow(JSON.stringify(invalid))).toThrow(
      "Workflow data does not match the supported schema.",
    );
  });
});
