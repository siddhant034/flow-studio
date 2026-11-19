import { describe, expect, it } from "vitest";
import {
  commitHistory,
  createHistory,
  redoHistory,
  undoHistory,
} from "./history";

describe("workflow history", () => {
  it("starts with the initial state and empty stacks", () => {
    expect(createHistory("initial")).toEqual({
      past: [],
      present: "initial",
      future: [],
      limit: 100,
    });
  });

  it("records new states and supports undo and redo", () => {
    const first = createHistory("first");
    const second = commitHistory(first, "second");
    const third = commitHistory(second, "third");

    const undone = undoHistory(third);
    const redone = redoHistory(undone);

    expect(undone.present).toBe("second");
    expect(redone.present).toBe("third");
  });

  it("clears the redo stack after a new commit", () => {
    const history = undoHistory(
      commitHistory(commitHistory(createHistory(1), 2), 3),
    );

    const branched = commitHistory(history, 4);

    expect(branched.present).toBe(4);
    expect(branched.future).toEqual([]);
  });

  it("does not record identical state references", () => {
    const history = createHistory({ value: 1 });

    expect(commitHistory(history, history.present)).toBe(history);
  });

  it("returns the same history when undo or redo is unavailable", () => {
    const history = createHistory("initial");

    expect(undoHistory(history)).toBe(history);
    expect(redoHistory(history)).toBe(history);
  });

  it("respects the configured history limit", () => {
    const history = commitHistory(
      commitHistory(
        commitHistory(createHistory(0, 2), 1),
        2,
      ),
      3,
    );

    expect(history.past).toEqual([1, 2]);
    expect(undoHistory(history).present).toBe(2);
  });

  it("rejects invalid history limits", () => {
    expect(() => createHistory("initial", 0)).toThrow(
      "History limit must be a positive integer.",
    );
    expect(() => createHistory("initial", 1.5)).toThrow(
      "History limit must be a positive integer.",
    );
  });

  it("does not mutate existing history snapshots", () => {
    const first = createHistory("first");
    const second = commitHistory(first, "second");

    expect(first.past).toEqual([]);
    expect(first.present).toBe("first");
    expect(first.future).toEqual([]);
    expect(second.past).toEqual(["first"]);
  });
});
