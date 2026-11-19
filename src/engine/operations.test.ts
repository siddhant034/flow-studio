import { describe, expect, it } from "vitest";
import { addNode } from "./operations";
import type { Workflow, WorkflowNode } from "./types";

const createWorkflow = (): Workflow => ({
  id: "workflow-1",
  version: 1,
  nodes: {},
  edges: {},
});

const createActionNode = (id: string): WorkflowNode => ({
  id,
  type: "action",
  label: "Send email",
  position: { x: 120, y: 80 },
  inputs: [{ id: "in", label: "Input" }],
  outputs: [{ id: "out", label: "Output" }],
  config: { action: "send-email" },
});

describe("addNode", () => {
  it("adds a node to the workflow", () => {
    const workflow = createWorkflow();
    const node = createActionNode("action-1");

    const result = addNode(workflow, node);

    expect(result.nodes["action-1"]).toEqual(node);
    expect(Object.keys(result.nodes)).toEqual(["action-1"]);
  });

  it("preserves workflow metadata and existing edges", () => {
    const workflow: Workflow = {
      ...createWorkflow(),
      nodes: { "action-1": createActionNode("action-1") },
      edges: {
        "edge-1": {
          id: "edge-1",
          source: { nodeId: "action-1", portId: "out" },
          target: { nodeId: "action-2", portId: "in" },
        },
      },
    };

    const result = addNode(workflow, createActionNode("action-2"));

    expect(result.id).toBe(workflow.id);
    expect(result.version).toBe(workflow.version);
    expect(result.edges).toBe(workflow.edges);
    expect(result.nodes).toHaveProperty("action-1");
    expect(result.nodes).toHaveProperty("action-2");
  });

  it("does not mutate the original workflow", () => {
    const workflow = createWorkflow();
    const node = createActionNode("action-1");

    const result = addNode(workflow, node);

    expect(workflow.nodes).toEqual({});
    expect(result).not.toBe(workflow);
    expect(result.nodes).not.toBe(workflow.nodes);
  });

  it("rejects a node with an existing id", () => {
    const workflow: Workflow = {
      ...createWorkflow(),
      nodes: { "action-1": createActionNode("action-1") },
    };

    expect(() => addNode(workflow, createActionNode("action-1"))).toThrow(
      'A node with id "action-1" already exists.',
    );
  });
});
