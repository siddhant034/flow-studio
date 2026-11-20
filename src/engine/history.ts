export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  limit: number;
};

export function createHistory<T>(
  initialState: T,
  limit = 100,
): History<T> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("History limit must be a positive integer.");
  }

  return {
    past: [],
    present: initialState,
    future: [],
    limit,
  };
}

/** Records a new state and clears the redo stack. */
export function commitHistory<T>(
  history: History<T>,
  nextState: T,
): History<T> {
  if (Object.is(history.present, nextState)) {
    return history;
  }

  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: nextState,
    future: [],
  };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) {
    return history;
  }

  const previous = history.past[history.past.length - 1];

  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) {
    return history;
  }

  const [next, ...future] = history.future;

  return {
    ...history,
    past: [...history.past, history.present].slice(-history.limit),
    present: next,
    future,
  };
}
