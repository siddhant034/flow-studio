import type {
  NodeId,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from "./types";

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

function hasOutputPort(node: WorkflowNode, portId: string): boolean {
  return "outputs" in node && node.outputs.some((port) => port.id === portId);
}

function hasInputPort(node: WorkflowNode, portId: string): boolean {
  return "inputs" in node && node.inputs.some((port) => port.id === portId);
}

function createsCycle(
  workflow: Workflow,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
): boolean {
  const visited = new Set<NodeId>();
  const pending = [targetNodeId];

  while (pending.length > 0) {
    const currentNodeId = pending.pop()!;

    if (currentNodeId === sourceNodeId) {
      return true;
    }

    if (visited.has(currentNodeId)) {
      continue;
    }

    visited.add(currentNodeId);

    for (const edge of Object.values(workflow.edges)) {
      if (edge.source.nodeId === currentNodeId) {
        pending.push(edge.target.nodeId);
      }
    }
  }

  return false;
}

export function addEdge(
  workflow: Workflow,
  edge: WorkflowEdge,
): Workflow {
  if (Object.hasOwn(workflow.edges, edge.id)) {
    throw new Error(`An edge with id "${edge.id}" already exists.`);
  }

  const sourceNode = workflow.nodes[edge.source.nodeId];
  if (!sourceNode) {
    throw new Error(
      `Source node "${edge.source.nodeId}" does not exist.`,
    );
  }

  const targetNode = workflow.nodes[edge.target.nodeId];
  if (!targetNode) {
    throw new Error(
      `Target node "${edge.target.nodeId}" does not exist.`,
    );
  }

  if (edge.source.nodeId === edge.target.nodeId) {
    throw new Error("A node cannot connect to itself.");
  }

  if (!hasOutputPort(sourceNode, edge.source.portId)) {
    throw new Error(
      `Output port "${edge.source.portId}" does not exist on node "${sourceNode.id}".`,
    );
  }

  if (!hasInputPort(targetNode, edge.target.portId)) {
    throw new Error(
      `Input port "${edge.target.portId}" does not exist on node "${targetNode.id}".`,
    );
  }

  const duplicateConnection = Object.values(workflow.edges).some(
    (existingEdge) =>
      existingEdge.source.nodeId === edge.source.nodeId &&
      existingEdge.source.portId === edge.source.portId &&
      existingEdge.target.nodeId === edge.target.nodeId &&
      existingEdge.target.portId === edge.target.portId,
  );

  if (duplicateConnection) {
    throw new Error("This connection already exists.");
  }

  if (createsCycle(workflow, edge.source.nodeId, edge.target.nodeId)) {
    throw new Error("This connection would create a cycle.");
  }

  return {
    ...workflow,
    edges: {
      ...workflow.edges,
      [edge.id]: edge,
    },
  };
}

export function removeEdge(
  workflow: Workflow,
  edgeId: string,
): Workflow {
  if (!Object.hasOwn(workflow.edges, edgeId)) {
    return workflow;
  }

  const { [edgeId]: _removedEdge, ...edges } = workflow.edges;

  return {
    ...workflow,
    edges,
  };
}

/**
 * Updates an existing node using an immutable updater.
 * Node identity and node kind are stable across updates.
 */
export function updateNode(
  workflow: Workflow,
  nodeId: NodeId,
  updater: (node: WorkflowNode) => WorkflowNode,
): Workflow {
  const currentNode = workflow.nodes[nodeId];

  if (!currentNode) {
    return workflow;
  }

  const updatedNode = updater(currentNode);

  if (updatedNode.id !== currentNode.id) {
    throw new Error("A node update cannot change its ID.");
  }

  if (updatedNode.type !== currentNode.type) {
    throw new Error("A node update cannot change its type.");
  }

  if (updatedNode === currentNode) {
    return workflow;
  }

  return {
    ...workflow,
    nodes: {
      ...workflow.nodes,
      [nodeId]: updatedNode,
    },
  };
}

/**
 * Moves a node to a new graph-space position without changing its other data.
 */
export function moveNode(
  workflow: Workflow,
  nodeId: NodeId,
  position: { x: number; y: number },
): Workflow {
  const node = workflow.nodes[nodeId];

  if (!node) {
    return workflow;
  }

  if (
    node.position.x === position.x &&
    node.position.y === position.y
  ) {
    return workflow;
  }

  return {
    ...workflow,
    nodes: {
      ...workflow.nodes,
      [nodeId]: {
        ...node,
        position: { ...position },
      },
    },
  };
}

/** Updates workflow-level metadata without replacing graph entities. */
export function updateWorkflowMetadata(
  workflow: Workflow,
  updates: Partial<Pick<Workflow, "name" | "description">>,
): Workflow {
  const nextName = updates.name ?? workflow.name;
  const nextDescription = updates.description ?? workflow.description;

  if (nextName === workflow.name && nextDescription === workflow.description) {
    return workflow;
  }

  return {
    ...workflow,
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.description !== undefined ? { description: updates.description } : {}),
  };
}
