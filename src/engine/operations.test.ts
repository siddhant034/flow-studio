import { describe, expect, it } from "vitest";
import { addEdge, addNode, moveNode, removeEdge, removeNode, updateNode, updateWorkflowMetadata } from "./operations";
import type { Workflow, WorkflowEdge, WorkflowNode } from "./types";

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

const createEdge = (
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
): WorkflowEdge => ({
  id,
  source: { nodeId: sourceNodeId, portId: "out" },
  target: { nodeId: targetNodeId, portId: "in" },
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
      edges: { "edge-1": createEdge("edge-1", "action-1", "action-2") },
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
      "edge-1": createEdge("edge-1", "action-1", "action-2"),
      "edge-2": createEdge("edge-2", "action-2", "action-3"),
      "edge-3": createEdge("edge-3", "action-1", "action-3"),
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

describe("addEdge", () => {
  const createTwoNodeWorkflow = (): Workflow => ({
    ...createWorkflow(),
    nodes: {
      "action-1": createActionNode("action-1"),
      "action-2": createActionNode("action-2"),
    },
  });

  it("adds a valid edge", () => {
    const workflow = createTwoNodeWorkflow();
    const edge = createEdge("edge-1", "action-1", "action-2");

    const result = addEdge(workflow, edge);

    expect(result.edges["edge-1"]).toEqual(edge);
    expect(workflow.edges).toEqual({});
    expect(result).not.toBe(workflow);
    expect(result.edges).not.toBe(workflow.edges);
  });

  it("rejects a duplicate edge id", () => {
    const workflow: Workflow = {
      ...createTwoNodeWorkflow(),
      edges: { "edge-1": createEdge("edge-1", "action-1", "action-2") },
    };

    expect(() =>
      addEdge(workflow, createEdge("edge-1", "action-2", "action-1")),
    ).toThrow('An edge with id "edge-1" already exists.');
  });

  it("rejects missing source and target nodes", () => {
    const workflow = createTwoNodeWorkflow();

    expect(() =>
      addEdge(workflow, createEdge("edge-1", "missing", "action-2")),
    ).toThrow('Source node "missing" does not exist.');

    expect(() =>
      addEdge(workflow, createEdge("edge-1", "action-1", "missing")),
    ).toThrow('Target node "missing" does not exist.');
  });

  it("rejects self connections", () => {
    const workflow = createTwoNodeWorkflow();

    expect(() =>
      addEdge(workflow, createEdge("edge-1", "action-1", "action-1")),
    ).toThrow("A node cannot connect to itself.");
  });

  it("rejects invalid source and target ports", () => {
    const workflow = createTwoNodeWorkflow();

    expect(() =>
      addEdge(workflow, {
        ...createEdge("edge-1", "action-1", "action-2"),
        source: { nodeId: "action-1", portId: "missing" },
      }),
    ).toThrow('Output port "missing" does not exist on node "action-1".');

    expect(() =>
      addEdge(workflow, {
        ...createEdge("edge-1", "action-1", "action-2"),
        target: { nodeId: "action-2", portId: "missing" },
      }),
    ).toThrow('Input port "missing" does not exist on node "action-2".');
  });

  it("rejects duplicate connections even when the edge id differs", () => {
    const workflow: Workflow = {
      ...createTwoNodeWorkflow(),
      edges: { "edge-1": createEdge("edge-1", "action-1", "action-2") },
    };

    expect(() =>
      addEdge(workflow, createEdge("edge-2", "action-1", "action-2")),
    ).toThrow("This connection already exists.");
  });

  it("rejects connections that would create a cycle", () => {
    const workflow: Workflow = {
      ...createTwoNodeWorkflow(),
      nodes: {
        ...createTwoNodeWorkflow().nodes,
        "action-3": createActionNode("action-3"),
      },
      edges: {
        "edge-1": createEdge("edge-1", "action-1", "action-2"),
        "edge-2": createEdge("edge-2", "action-2", "action-3"),
      },
    };

    expect(() =>
      addEdge(workflow, createEdge("edge-3", "action-3", "action-1")),
    ).toThrow("This connection would create a cycle.");
  });

  it("enforces Start and End direction through their available ports", () => {
    const workflow: Workflow = {
      ...createWorkflow(),
      nodes: {
        start: {
          id: "start",
          type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          outputs: [{ id: "out", label: "Output" }],
        },
        action: createActionNode("action"),
        end: {
          id: "end",
          type: "end",
          label: "End",
          position: { x: 300, y: 0 },
          inputs: [{ id: "in", label: "Input" }],
        },
      },
    };

    expect(() =>
      addEdge(workflow, {
        id: "edge-1",
        source: { nodeId: "end", portId: "in" },
        target: { nodeId: "action", portId: "in" },
      }),
    ).toThrow('Output port "in" does not exist on node "end".');

    expect(() =>
      addEdge(workflow, {
        id: "edge-2",
        source: { nodeId: "action", portId: "out" },
        target: { nodeId: "start", portId: "out" },
      }),
    ).toThrow('Input port "out" does not exist on node "start".');
  });
});

describe("removeEdge", () => {
  const createConnectedWorkflow = (): Workflow => ({
    ...createWorkflow(),
    nodes: {
      "action-1": createActionNode("action-1"),
      "action-2": createActionNode("action-2"),
      "action-3": createActionNode("action-3"),
    },
    edges: {
      "edge-1": createEdge("edge-1", "action-1", "action-2"),
      "edge-2": createEdge("edge-2", "action-2", "action-3"),
    },
  });

  it("removes the requested edge while preserving nodes and other edges", () => {
    const workflow = createConnectedWorkflow();

    const result = removeEdge(workflow, "edge-1");

    expect(result.edges).toEqual({
      "edge-2": workflow.edges["edge-2"],
    });
    expect(result.nodes).toBe(workflow.nodes);
    expect(result.edges).not.toBe(workflow.edges);
  });

  it("preserves workflow metadata", () => {
    const workflow = createConnectedWorkflow();

    const result = removeEdge(workflow, "edge-1");

    expect(result.id).toBe(workflow.id);
    expect(result.version).toBe(workflow.version);
  });

  it("does not mutate the original workflow", () => {
    const workflow = createConnectedWorkflow();

    const result = removeEdge(workflow, "edge-1");

    expect(workflow.edges).toHaveProperty("edge-1");
    expect(result).not.toBe(workflow);
    expect(result.edges).not.toBe(workflow.edges);
  });

  it("returns the original workflow when the edge does not exist", () => {
    const workflow = createConnectedWorkflow();

    expect(removeEdge(workflow, "missing-edge")).toBe(workflow);
  });
});

describe("updateNode", () => {
  const createWorkflowWithNode = (): Workflow => ({
    ...createWorkflow(),
    nodes: {
      "action-1": createActionNode("action-1"),
      "action-2": createActionNode("action-2"),
    },
  });

  it("updates a node immutably", () => {
    const workflow = createWorkflowWithNode();
    const result = updateNode(workflow, "action-1", (node) => ({
      ...node,
      label: "Updated action",
      position: { x: 240, y: 160 },
    }));

    expect(result.nodes["action-1"].label).toBe("Updated action");
    expect(result.nodes["action-1"].position).toEqual({ x: 240, y: 160 });
    expect(workflow.nodes["action-1"].label).toBe("Send email");
    expect(result).not.toBe(workflow);
    expect(result.nodes).not.toBe(workflow.nodes);
  });

  it("preserves unrelated nodes, edges, and workflow metadata", () => {
    const workflow: Workflow = {
      ...createWorkflowWithNode(),
      edges: { "edge-1": createEdge("edge-1", "action-1", "action-2") },
    };

    const result = updateNode(workflow, "action-1", (node) => ({
      ...node,
      label: "Updated",
    }));

    expect(result.id).toBe(workflow.id);
    expect(result.version).toBe(workflow.version);
    expect(result.nodes["action-2"]).toBe(workflow.nodes["action-2"]);
    expect(result.edges).toBe(workflow.edges);
  });

  it("returns the original workflow when the node does not exist", () => {
    const workflow = createWorkflowWithNode();

    expect(
      updateNode(workflow, "missing-node", (node) => node),
    ).toBe(workflow);
  });

  it("returns the original workflow when the updater returns the same node", () => {
    const workflow = createWorkflowWithNode();

    expect(
      updateNode(workflow, "action-1", (node) => node),
    ).toBe(workflow);
  });

  it("does not allow changing the node ID", () => {
    const workflow = createWorkflowWithNode();

    expect(() =>
      updateNode(workflow, "action-1", (node) => ({
        ...node,
        id: "different-id",
      })),
    ).toThrow("A node update cannot change its ID.");
  });

  it("does not allow changing the node type", () => {
    const workflow = createWorkflowWithNode();

    expect(() =>
      updateNode(workflow, "action-1", (node) => ({
        ...node,
        type: "condition",
        config: { expression: "true" },
      } as unknown as WorkflowNode)),
    ).toThrow("A node update cannot change its type.");
  });
});

describe("moveNode", () => {
  const createWorkflowWithNodes = (): Workflow => ({
    ...createWorkflow(),
    nodes: {
      "action-1": createActionNode("action-1"),
      "action-2": createActionNode("action-2"),
    },
    edges: {
      "edge-1": createEdge("edge-1", "action-1", "action-2"),
    },
  });

  it("updates the node position immutably", () => {
    const workflow = createWorkflowWithNodes();
    const result = moveNode(workflow, "action-1", { x: 300, y: 180 });

    expect(result.nodes["action-1"].position).toEqual({ x: 300, y: 180 });
    expect(workflow.nodes["action-1"].position).toEqual({ x: 120, y: 80 });
    expect(result).not.toBe(workflow);
    expect(result.nodes).not.toBe(workflow.nodes);
  });

  it("preserves node data, other nodes, edges, and metadata", () => {
    const workflow = createWorkflowWithNodes();
    const result = moveNode(workflow, "action-1", { x: 300, y: 180 });

    expect(result.nodes["action-1"].label).toBe(workflow.nodes["action-1"].label);
    expect(result.nodes["action-2"]).toBe(workflow.nodes["action-2"]);
    expect(result.edges).toBe(workflow.edges);
    expect(result.id).toBe(workflow.id);
    expect(result.version).toBe(workflow.version);
  });

  it("returns the original workflow when the node does not exist", () => {
    const workflow = createWorkflowWithNodes();

    expect(moveNode(workflow, "missing-node", { x: 1, y: 2 })).toBe(workflow);
  });

  it("returns the original workflow when the position is unchanged", () => {
    const workflow = createWorkflowWithNodes();

    expect(
      moveNode(workflow, "action-1", { x: 120, y: 80 }),
    ).toBe(workflow);
  });
});

describe("updateWorkflowMetadata", () => {
  it("updates the workflow name and description immutably", () => {
    const workflow: Workflow = {
      ...createWorkflow(),
      name: "Lead flow",
      description: "Qualify incoming leads",
    };

    const result = updateWorkflowMetadata(workflow, {
      name: "Customer onboarding",
      description: "Welcome new customers",
    });

    expect(result.name).toBe("Customer onboarding");
    expect(result.description).toBe("Welcome new customers");
    expect(result.nodes).toBe(workflow.nodes);
    expect(result.edges).toBe(workflow.edges);
    expect(workflow.name).toBe("Lead flow");
    expect(result).not.toBe(workflow);
  });

  it("preserves metadata fields that are not included in the update", () => {
    const workflow: Workflow = {
      ...createWorkflow(),
      name: "Lead flow",
      description: "Qualify incoming leads",
    };

    const result = updateWorkflowMetadata(workflow, { name: "Sales flow" });

    expect(result.name).toBe("Sales flow");
    expect(result.description).toBe("Qualify incoming leads");
  });

  it("returns the original workflow when metadata is unchanged", () => {
    const workflow: Workflow = {
      ...createWorkflow(),
      name: "Lead flow",
    };

    expect(updateWorkflowMetadata(workflow, { name: "Lead flow" })).toBe(workflow);
  });
});
