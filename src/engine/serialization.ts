import { validateWorkflow } from "./validation";
import type { Workflow, WorkflowEdge, WorkflowNode, Port } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPort(value: unknown): value is Port {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.label === "string"
  );
}

function isNode(value: unknown): value is WorkflowNode {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    !isRecord(value.position) ||
    typeof value.position.x !== "number" ||
    typeof value.position.y !== "number"
  ) {
    return false;
  }

  const inputsValid =
    !("inputs" in value) ||
    (Array.isArray(value.inputs) && value.inputs.every(isPort));
  const outputsValid =
    !("outputs" in value) ||
    (Array.isArray(value.outputs) && value.outputs.every(isPort));

  if (!inputsValid || !outputsValid) {
    return false;
  }

  switch (value.type) {
    case "start":
      return (
        !("inputs" in value) &&
        Array.isArray(value.outputs) &&
        value.outputs.every(isPort)
      );
    case "action":
      return (
        Array.isArray(value.inputs) &&
        Array.isArray(value.outputs) &&
        isRecord(value.config) &&
        typeof value.config.action === "string"
      );
    case "condition":
      return (
        Array.isArray(value.inputs) &&
        Array.isArray(value.outputs) &&
        isRecord(value.config) &&
        typeof value.config.expression === "string"
      );
    case "end":
      return (
        Array.isArray(value.inputs) &&
        value.inputs.every(isPort) &&
        !("outputs" in value)
      );
    default:
      return false;
  }
}

function isEdge(value: unknown): value is WorkflowEdge {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isRecord(value.source) &&
    typeof value.source.nodeId === "string" &&
    typeof value.source.portId === "string" &&
    isRecord(value.target) &&
    typeof value.target.nodeId === "string" &&
    typeof value.target.portId === "string"
  );
}

function isWorkflow(value: unknown): value is Workflow {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.version !== 1 ||
    !isRecord(value.nodes) ||
    !isRecord(value.edges)
  ) {
    return false;
  }

  return (
    Object.values(value.nodes).every(isNode) &&
    Object.values(value.edges).every(isEdge)
  );
}

export function serializeWorkflow(workflow: Workflow): string {
  return JSON.stringify(workflow, null, 2);
}

/**
 * Parses and validates serialized workflow data before returning it.
 * Throws a descriptive error for malformed JSON, invalid shape, or graph invariants.
 */
export function deserializeWorkflow(serialized: string): Workflow {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Workflow data is not valid JSON.");
  }

  if (!isWorkflow(parsed)) {
    throw new Error("Workflow data does not match the supported schema.");
  }

  const validation = validateWorkflow(parsed);
  if (!validation.valid) {
    const details = validation.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join("\n");

    throw new Error(`Workflow data is invalid:\n${details}`);
  }

  return parsed;
}
