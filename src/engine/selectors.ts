import type { NodeId, Workflow, WorkflowEdge } from "./types";

/** Returns edges whose target endpoint belongs to the given node. */
export function getIncomingEdges(
  workflow: Workflow,
  nodeId: NodeId,
): WorkflowEdge[] {
  return Object.values(workflow.edges).filter(
    (edge) => edge.target.nodeId === nodeId,
  );
}

/** Returns edges whose source endpoint belongs to the given node. */
export function getOutgoingEdges(
  workflow: Workflow,
  nodeId: NodeId,
): WorkflowEdge[] {
  return Object.values(workflow.edges).filter(
    (edge) => edge.source.nodeId === nodeId,
  );
}

/** Returns every edge attached to the node, without duplicate edge entries. */
export function getConnectedEdges(
  workflow: Workflow,
  nodeId: NodeId,
): WorkflowEdge[] {
  return Object.values(workflow.edges).filter(
    (edge) =>
      edge.source.nodeId === nodeId || edge.target.nodeId === nodeId,
  );
}

/** Returns unique nodes directly connected to the given node. */
export function getNeighborNodeIds(
  workflow: Workflow,
  nodeId: NodeId,
): NodeId[] {
  const neighbors = new Set<NodeId>();

  for (const edge of getConnectedEdges(workflow, nodeId)) {
    if (edge.source.nodeId === nodeId && edge.target.nodeId !== nodeId) {
      neighbors.add(edge.target.nodeId);
    }

    if (edge.target.nodeId === nodeId && edge.source.nodeId !== nodeId) {
      neighbors.add(edge.source.nodeId);
    }
  }

  return [...neighbors];
}
