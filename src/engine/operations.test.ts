import { describe, expect, it } from "vitest";
import { addNode, removeNode } from "./operations";
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

describe("removeNode", () => {
  const createConnectedWorkflow = (): Workflow => ({
    ...createWorkflow(),
    nodes: {
      "action-1": createActionNode("action-1"),
      "action-2": createActionNode("action-2"),
      "action-3": createActionNode("action-3"),
    },
    edges: {
      "edge-1": {
        id: "edge-1",
        source: { nodeId: "action-1", portId: "out" },
        target: { nodeId: "action-2", portId: "in" },
      },
      "edge-2": {
        id: "edge-2",
        source: { nodeId: "action-2", portId: "out" },
        target: { nodeId: "action-3", portId: "in" },
      },
      "edge-3": {
        id: "edge-3",
        source: { nodeId: "action-1", portId: "out" },
        target: { nodeId: "action-3", portId: "in" },
      },
    },
  });

  it("removes the node and every edge connected to it", () => {
    const workflow = createConnectedWorkflow();

    const result = removeNode(workflow, "action-2");

    expect(result.nodes).not.toHaveProperty("action-2");
    expect(result.nodes).toHaveProperty("action-1");
    expect(result.nodes).toHaveProperty("action-3");
    expect(result.edges).toEqual({
      "edge-3": workflow.edges["edge-3"],
    });
  });

  it("preserves workflow metadata and unrelated graph entities", () => {
    const workflow = createConnectedWorkflow();

    const result = removeNode(workflow, "action-2");

    expect(result.id).toBe(workflow.id);
    expect(result.version).toBe(workflow.version);
    expect(result.nodes["action-1"]).toBe(workflow.nodes["action-1"]);
    expect(result.edges["edge-3"]).toBe(workflow.edges["edge-3"]);
  });

  it("does not mutate the original workflow", () => {
    const workflow = createConnectedWorkflow();

    const result = removeNode(workflow, "action-2");

    expect(workflow.nodes).toHaveProperty("action-2");
    expect(workflow.edges).toHaveProperty("edge-1");
    expect(workflow.edges).toHaveProperty("edge-2");
    expect(result).not.toBe(workflow);
    expect(result.nodes).not.toBe(workflow.nodes);
    expect(result.edges).not.toBe(workflow.edges);
  });

  it("returns the original workflow when the node does not exist", () => {
    const workflow = createConnectedWorkflow();

    expect(removeNode(workflow, "missing-node")).toBe(workflow);
  });
});
