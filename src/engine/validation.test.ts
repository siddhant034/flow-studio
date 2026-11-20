import { describe, expect, it } from "vitest";
import { validateWorkflow } from "./validation";
import type { Workflow, WorkflowEdge, WorkflowNode } from "./types";

const createActionNode = (id: string): WorkflowNode => ({
  id,
  type: "action",
  label: "Action",
  position: { x: 0, y: 0 },
  inputs: [{ id: "in", label: "Input" }],
  outputs: [{ id: "out", label: "Output" }],
  config: { action: "run" },
});

const createEdge = (
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
): WorkflowEdge => ({
  id,
  source: { nodeId: sourceNodeId, portId: "out" },
  target: { nodeId: targetNodeId, portId: "in" },
});

const createWorkflow = (): Workflow => ({
  id: "workflow-1",
  version: 1,
  nodes: {
    "action-1": createActionNode("action-1"),
    "action-2": createActionNode("action-2"),
  },
  edges: {
    "edge-1": createEdge("edge-1", "action-1", "action-2"),
  },
});

describe("validateWorkflow", () => {
  it("accepts a valid workflow", () => {
    expect(validateWorkflow(createWorkflow())).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("reports node and edge key mismatches", () => {
    const workflow = createWorkflow();
    workflow.nodes["action-1"] = createActionNode("different-node");
    workflow.edges["edge-1"] = {
      ...workflow.edges["edge-1"],
      id: "different-edge",
    };

    const result = validateWorkflow(workflow);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["node-id-mismatch", "edge-id-mismatch"]),
    );
  });

  it("reports missing source and target nodes", () => {
    const workflow = createWorkflow();
    workflow.edges["edge-1"] = createEdge("edge-1", "missing-source", "missing-target");

    const result = validateWorkflow(workflow);

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing-source-node", "missing-target-node"]),
    );
  });

  it("reports missing ports and self-connections", () => {
    const workflow = createWorkflow();
    workflow.edges["edge-1"] = {
      id: "edge-1",
      source: { nodeId: "action-1", portId: "missing-output" },
      target: { nodeId: "action-1", portId: "missing-input" },
    };

    const result = validateWorkflow(workflow);

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-source-port",
        "missing-target-port",
        "self-connection",
      ]),
    );
  });

  it("reports duplicate connections", () => {
    const workflow = createWorkflow();
    workflow.edges["edge-2"] = createEdge("edge-2", "action-1", "action-2");

    expect(validateWorkflow(workflow).issues).toContainEqual(
      expect.objectContaining({ code: "duplicate-connection" }),
    );
  });

  it("reports cycles", () => {
    const workflow = createWorkflow();
    workflow.nodes["action-3"] = createActionNode("action-3");
    workflow.edges["edge-2"] = createEdge("edge-2", "action-2", "action-3");
    workflow.edges["edge-3"] = createEdge("edge-3", "action-3", "action-1");

    expect(validateWorkflow(workflow).issues).toContainEqual(
      expect.objectContaining({ code: "cycle-detected" }),
    );
  });

  it("reports Start incoming and End outgoing connections", () => {
    const workflow = createWorkflow();
    workflow.nodes.start = {
      id: "start",
      type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      outputs: [{ id: "out", label: "Output" }],
    };
    workflow.nodes.end = {
      id: "end",
      type: "end",
      label: "End",
      position: { x: 0, y: 0 },
      inputs: [{ id: "in", label: "Input" }],
    };
    workflow.edges["edge-2"] = {
      id: "edge-2",
      source: { nodeId: "action-1", portId: "out" },
      target: { nodeId: "start", portId: "out" },
    };
    workflow.edges["edge-3"] = {
      id: "edge-3",
      source: { nodeId: "end", portId: "in" },
      target: { nodeId: "action-2", portId: "in" },
    };

    const codes = validateWorkflow(workflow).issues.map((issue) => issue.code);

    expect(codes).toContain("start-node-has-incoming-edge");
    expect(codes).toContain("end-node-has-outgoing-edge");
  });

  it("reports duplicate port IDs within the same direction", () => {
    const workflow = createWorkflow();
    workflow.nodes["action-1"] = {
      ...createActionNode("action-1"),
      inputs: [
        { id: "in", label: "First" },
        { id: "in", label: "Second" },
      ],
    };

    expect(validateWorkflow(workflow).issues).toContainEqual(
      expect.objectContaining({ code: "duplicate-port-id" }),
    );
  });

  it("does not mutate the supplied workflow", () => {
    const workflow = createWorkflow();
    const nodes = workflow.nodes;
    const edges = workflow.edges;

    validateWorkflow(workflow);

    expect(workflow.nodes).toBe(nodes);
    expect(workflow.edges).toBe(edges);
  });

  it("reports an empty workflow ID", () => {
    const workflow = { ...createWorkflow(), id: " " };

    expect(validateWorkflow(workflow).issues).toContainEqual(
      expect.objectContaining({ code: "invalid-workflow-id" }),
    );
  });
});
