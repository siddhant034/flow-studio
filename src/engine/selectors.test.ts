import { describe, expect, it } from "vitest";
import {
  getConnectedEdges,
  getIncomingEdges,
  getNeighborNodeIds,
  getOutgoingEdges,
} from "./selectors";
import type { Workflow, WorkflowEdge, WorkflowNode } from "./types";

const createNode = (id: string): WorkflowNode => ({
  id,
  type: "action",
  label: id,
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
    a: createNode("a"),
    b: createNode("b"),
    c: createNode("c"),
    d: createNode("d"),
  },
  edges: {
    ab: createEdge("ab", "a", "b"),
    ba: createEdge("ba", "b", "a"),
    ac: createEdge("ac", "a", "c"),
    cd: createEdge("cd", "c", "d"),
  },
});

describe("workflow selectors", () => {
  it("returns incoming edges", () => {
    const workflow = createWorkflow();

    expect(getIncomingEdges(workflow, "a").map((edge) => edge.id)).toEqual(["ba"]);
    expect(getIncomingEdges(workflow, "missing")).toEqual([]);
  });

  it("returns outgoing edges", () => {
    const workflow = createWorkflow();

    expect(getOutgoingEdges(workflow, "a").map((edge) => edge.id)).toEqual(["ab", "ac"]);
    expect(getOutgoingEdges(workflow, "missing")).toEqual([]);
  });

  it("returns connected edges once, including incoming and outgoing", () => {
    const workflow = createWorkflow();

    expect(getConnectedEdges(workflow, "a").map((edge) => edge.id)).toEqual([
      "ab",
      "ba",
      "ac",
    ]);
  });

  it("returns unique neighboring node IDs", () => {
    const workflow = createWorkflow();

    expect(getNeighborNodeIds(workflow, "a")).toEqual(["b", "c"]);
    expect(getNeighborNodeIds(workflow, "missing")).toEqual([]);
  });

  it("does not mutate the workflow", () => {
    const workflow = createWorkflow();
    const nodes = workflow.nodes;
    const edges = workflow.edges;

    getIncomingEdges(workflow, "a");
    getOutgoingEdges(workflow, "a");
    getConnectedEdges(workflow, "a");
    getNeighborNodeIds(workflow, "a");

    expect(workflow.nodes).toBe(nodes);
    expect(workflow.edges).toBe(edges);
  });
});
