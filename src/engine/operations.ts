import type { NodeId, Workflow, WorkflowNode } from "./types";

export function addNode(
  workflow: Workflow,
  node: WorkflowNode,
): Workflow {
  if (Object.hasOwn(workflow.nodes, node.id)) {
    throw new Error(`A node with id "${node.id}" already exists.`);
  }

  return {
    ...workflow,
    nodes: {
      ...workflow.nodes,
      [node.id]: node,
    },
  };
}

export function removeNode(
  workflow: Workflow,
  nodeId: NodeId,
): Workflow {
  if (!Object.hasOwn(workflow.nodes, nodeId)) {
    return workflow;
  }

  const { [nodeId]: _removedNode, ...nodes } = workflow.nodes;
  const edges = Object.fromEntries(
    Object.entries(workflow.edges).filter(
      ([, edge]) =>
        edge.source.nodeId !== nodeId && edge.target.nodeId !== nodeId,
    ),
  );

  return {
    ...workflow,
    nodes,
    edges,
  };
}
