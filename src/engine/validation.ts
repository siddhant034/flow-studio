import type { Workflow, WorkflowNode } from "./types";

export type WorkflowValidationIssueCode =
  | "invalid-workflow-id"
  | "node-id-mismatch"
  | "edge-id-mismatch"
  | "duplicate-port-id"
  | "missing-source-node"
  | "missing-target-node"
  | "missing-source-port"
  | "missing-target-port"
  | "self-connection"
  | "duplicate-connection"
  | "start-node-has-incoming-edge"
  | "end-node-has-outgoing-edge"
  | "cycle-detected";

export type WorkflowValidationIssue = {
  code: WorkflowValidationIssueCode;
  message: string;
  path: string;
};

export type WorkflowValidationResult = {
  valid: boolean;
  issues: WorkflowValidationIssue[];
};

function hasPort(
  node: WorkflowNode,
  direction: "inputs" | "outputs",
  portId: string,
): boolean {
  return direction in node &&
    node[direction].some((port) => port.id === portId);
}

function findDuplicatePortIds(node: WorkflowNode): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const port of [
    ...("inputs" in node ? node.inputs : []),
    ...("outputs" in node ? node.outputs : []),
  ]) {
    if (seen.has(port.id)) {
      duplicates.add(port.id);
    }
    seen.add(port.id);
  }

  return [...duplicates];
}

function hasCycle(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
): boolean {
  const inDegree = new Map(nodeIds.map((nodeId) => [nodeId, 0]));

  for (const targets of adjacency.values()) {
    for (const targetId of targets) {
      inDegree.set(targetId, (inDegree.get(targetId) ?? 0) + 1);
    }
  }

  const ready = nodeIds.filter((nodeId) => inDegree.get(nodeId) === 0);
  let visitedCount = 0;

  while (ready.length > 0) {
    const nodeId = ready.pop()!;
    visitedCount += 1;

    for (const targetId of adjacency.get(nodeId) ?? []) {
      const nextDegree = (inDegree.get(targetId) ?? 0) - 1;
      inDegree.set(targetId, nextDegree);

      if (nextDegree === 0) {
        ready.push(targetId);
      }
    }
  }

  return visitedCount !== nodeIds.length;
}

/**
 * Checks graph integrity without mutating the workflow or throwing.
 * Returns every detected issue so callers can present useful feedback.
 */
export function validateWorkflow(
  workflow: Workflow,
): WorkflowValidationResult {
  const issues: WorkflowValidationIssue[] = [];
  const addIssue = (
    code: WorkflowValidationIssueCode,
    message: string,
    path: string,
  ) => issues.push({ code, message, path });

  if (!workflow.id.trim()) {
    addIssue("invalid-workflow-id", "Workflow ID cannot be empty.", "id");
  }

  for (const [nodeKey, node] of Object.entries(workflow.nodes)) {
    if (node.id !== nodeKey) {
      addIssue(
        "node-id-mismatch",
        `Node key "${nodeKey}" does not match node ID "${node.id}".`,
        `nodes.${nodeKey}.id`,
      );
    }

    for (const portId of findDuplicatePortIds(node)) {
      addIssue(
        "duplicate-port-id",
        `Port ID "${portId}" is duplicated on node "${node.id}".`,
        `nodes.${nodeKey}`,
      );
    }
  }

  const adjacency = new Map<string, string[]>(
    Object.keys(workflow.nodes).map((nodeId) => [nodeId, []]),
  );
  const connections = new Set<string>();

  for (const [edgeKey, edge] of Object.entries(workflow.edges)) {
    if (edge.id !== edgeKey) {
      addIssue(
        "edge-id-mismatch",
        `Edge key "${edgeKey}" does not match edge ID "${edge.id}".`,
        `edges.${edgeKey}.id`,
      );
    }

    const sourceNode = workflow.nodes[edge.source.nodeId];
    const targetNode = workflow.nodes[edge.target.nodeId];

    if (!sourceNode) {
      addIssue(
        "missing-source-node",
        `Source node "${edge.source.nodeId}" does not exist.`,
        `edges.${edgeKey}.source.nodeId`,
      );
    }

    if (!targetNode) {
      addIssue(
        "missing-target-node",
        `Target node "${edge.target.nodeId}" does not exist.`,
        `edges.${edgeKey}.target.nodeId`,
      );
    }

    if (edge.source.nodeId === edge.target.nodeId) {
      addIssue(
        "self-connection",
        "A node cannot connect to itself.",
        `edges.${edgeKey}`,
      );
    }

    if (sourceNode && targetNode) {
      adjacency.get(edge.source.nodeId)?.push(edge.target.nodeId);

      if (!hasPort(sourceNode, "outputs", edge.source.portId)) {
        addIssue(
          "missing-source-port",
          `Output port "${edge.source.portId}" does not exist on node "${sourceNode.id}".`,
          `edges.${edgeKey}.source.portId`,
        );
      }

      if (!hasPort(targetNode, "inputs", edge.target.portId)) {
        addIssue(
          "missing-target-port",
          `Input port "${edge.target.portId}" does not exist on node "${targetNode.id}".`,
          `edges.${edgeKey}.target.portId`,
        );
      }

      if (targetNode.type === "start") {
        addIssue(
          "start-node-has-incoming-edge",
          "A Start node cannot have incoming edges.",
          `edges.${edgeKey}.target`,
        );
      }

      if (sourceNode.type === "end") {
        addIssue(
          "end-node-has-outgoing-edge",
          "An End node cannot have outgoing edges.",
          `edges.${edgeKey}.source`,
        );
      }
    }

    const connectionKey = JSON.stringify([
      edge.source.nodeId,
      edge.source.portId,
      edge.target.nodeId,
      edge.target.portId,
    ]);

    if (connections.has(connectionKey)) {
      addIssue(
        "duplicate-connection",
        "This connection already exists.",
        `edges.${edgeKey}`,
      );
    }
    connections.add(connectionKey);
  }

  if (hasCycle(Object.keys(workflow.nodes), adjacency)) {
    addIssue(
      "cycle-detected",
      "Workflow contains a cycle.",
      "edges",
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
