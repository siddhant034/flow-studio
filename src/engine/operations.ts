import type { Workflow, WorkflowNode } from "./types";

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
