import { describe, expect, it } from "vitest";
import { createWorkflowStorage } from "./storage";
import type { Workflow } from "./types";

const workflow: Workflow = {
  id: "workflow-1",
  version: 1,
  nodes: {
    start: {
      id: "start",
      type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      outputs: [{ id: "out", label: "Next" }],
    },
    end: {
      id: "end",
      type: "end",
      label: "End",
      position: { x: 240, y: 0 },
      inputs: [{ id: "in", label: "Input" }],
    },
  },
  edges: {
    "edge-1": {
      id: "edge-1",
      source: { nodeId: "start", portId: "out" },
      target: { nodeId: "end", portId: "in" },
    },
  },
};

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    values,
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("workflow storage", () => {
  it("returns null when no workflow has been saved", () => {
    const storage = createWorkflowStorage(createMemoryStorage());

    expect(storage.load()).toBeNull();
  });

  it("saves and loads a workflow", () => {
    const storage = createWorkflowStorage(createMemoryStorage());

    storage.save(workflow);

    expect(storage.load()).toEqual(workflow);
  });

  it("uses an isolated storage key", () => {
    const memory = createMemoryStorage();
    const first = createWorkflowStorage(memory, "first");
    const second = createWorkflowStorage(memory, "second");

    first.save(workflow);

    expect(first.load()).toEqual(workflow);
    expect(second.load()).toBeNull();
  });

  it("removes the saved workflow", () => {
    const storage = createWorkflowStorage(createMemoryStorage());

    storage.save(workflow);
    storage.remove();

    expect(storage.load()).toBeNull();
  });

  it("surfaces invalid saved data instead of silently accepting it", () => {
    const memory = createMemoryStorage();
    memory.setItem("flow-studio:workflow", "{invalid");

    const storage = createWorkflowStorage(memory);

    expect(() => storage.load()).toThrow("Workflow data is not valid JSON.");
  });
});
