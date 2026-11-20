// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  window.localStorage.clear();
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  Object.defineProperty(window, "PointerEvent", { configurable: true, value: TestPointerEvent });
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: () => undefined,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderEditor() {
  render(<App />);
  return {
    canvas: screen.getByRole("region", { name: /Workflow canvas/ }),
    enrichNode: () => screen.getByRole("button", { name: /Node Enrich lead data/ }),
  };
}

describe("workflow editor interactions", () => {
  it("moves a focused node with the keyboard", () => {
    const { enrichNode } = renderEditor();
    const node = enrichNode();
    const initialLeft = Number.parseFloat((node as HTMLElement).style.left);

    fireEvent.keyDown(node, { key: "ArrowRight" });

    expect(Number.parseFloat((enrichNode() as HTMLElement).style.left)).toBe(initialLeft + 10);
  });

  it("moves a node with pointer dragging", () => {
    const { canvas, enrichNode } = renderEditor();
    const node = enrichNode();
    const initialLeft = Number.parseFloat((node as HTMLElement).style.left);

    fireEvent.pointerDown(node, { pointerId: 7, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 150, clientY: 130 });
    fireEvent.pointerUp(canvas, { pointerId: 7, clientX: 150, clientY: 130 });

    expect(Number.parseFloat((enrichNode() as HTMLElement).style.left)).toBe(initialLeft + 50);
  });

  it("connects an output to an input port", () => {
    const { canvas } = renderEditor();
    const output = screen.getByRole("button", { name: /Start connection from New lead received, Next output/ });
    const input = screen.getByRole("button", { name: /Connect to Send to sales, Input input/ });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => input,
    });

    fireEvent.pointerDown(output, { pointerId: 9, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { pointerId: 9, clientX: 20, clientY: 20 });

    expect(document.querySelectorAll(".graph-edge")).toHaveLength(5);
    expect(screen.getByRole("status").textContent).toContain("Connection created");
  });

  it("announces rejected duplicate connections", () => {
    const { canvas } = renderEditor();
    const output = screen.getByRole("button", { name: /Start connection from New lead received, Next output/ });
    const input = screen.getByRole("button", { name: /Connect to Enrich lead data, Input input/ });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => input,
    });

    fireEvent.pointerDown(output, { pointerId: 10, button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { pointerId: 10, clientX: 20, clientY: 20 });

    expect(screen.getByRole("status").textContent).toContain("This connection already exists.");
  });

  it("edits a selected node label in the inspector", () => {
    const { enrichNode } = renderEditor();
    fireEvent.click(enrichNode());
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "Normalize lead" } });

    expect(screen.getByRole("button", { name: /Node Normalize lead/ })).toBeTruthy();
  });

  it("duplicates the full workflow with its graph intact", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    expect(screen.getAllByText("Lead enrichment copy").length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".graph-edge")).toHaveLength(4);
    expect(screen.getByRole("status").textContent).toContain("Workflow duplicated");
  });

  it("connects nodes using only the keyboard", () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Start connection from New lead received, Next output/ }));
    fireEvent.click(screen.getByRole("button", { name: /Connect to Send to sales, Input input/ }));

    expect(document.querySelectorAll(".graph-edge")).toHaveLength(5);
    expect(screen.getByRole("status").textContent).toContain("Connection created");
  });

  it("deletes a selected node and removes it from the canvas", () => {
    const { enrichNode } = renderEditor();
    fireEvent.click(enrichNode());
    fireEvent.click(screen.getByRole("button", { name: "Delete node" }));

    expect(screen.queryByRole("button", { name: /Node Enrich lead data/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Enrich lead data deleted");
  });
});
