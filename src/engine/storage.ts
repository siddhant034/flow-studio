import { deserializeWorkflow, serializeWorkflow } from "./serialization";
import type { Workflow } from "./types";

export type KeyValueStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type WorkflowStorage = {
  save(workflow: Workflow): void;
  load(): Workflow | null;
  remove(): void;
};

export function createWorkflowStorage(
  storage: KeyValueStorage,
  key = "flow-studio:workflow",
): WorkflowStorage {
  return {
    save(workflow) {
      storage.setItem(key, serializeWorkflow(workflow));
    },

    load() {
      const serialized = storage.getItem(key);
      return serialized === null ? null : deserializeWorkflow(serialized);
    },

    remove() {
      storage.removeItem(key);
    },
  };
}
