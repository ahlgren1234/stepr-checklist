import { loadCompleted, saveCompleted } from './storage.js';

/** A step as defined by the consumer. */
export interface ChecklistStep {
  /** Stable, non-empty identifier, unique within one checklist. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /**
   * Called when the step is activated (see {@link ChecklistController.click}).
   * Activation never changes completion; call `checklist.complete(step.id)`
   * from here if that is the desired behavior.
   */
  readonly onClick?: (
    step: ChecklistStepState,
    checklist: ChecklistController,
  ) => void;
}

/** Read-only view of a step at a point in time. */
export interface ChecklistStepState {
  readonly id: string;
  readonly label: string;
  readonly completed: boolean;
}

/** Completion progress. `total` is 0 for an empty checklist. */
export interface ChecklistProgress {
  readonly completed: number;
  readonly total: number;
}

/** Read-only view of the whole checklist at a point in time. */
export interface ChecklistState {
  /** Steps in definition order. */
  readonly steps: readonly ChecklistStepState[];
  readonly progress: ChecklistProgress;
}

/** Called after every state change with the new state. */
export type ChecklistListener = (state: ChecklistState) => void;

export interface ChecklistControllerOptions {
  /** Steps in display order. May be empty. */
  readonly steps: readonly ChecklistStep[];
  /** Consumer callback, called after every state change. */
  readonly onChange?: ChecklistListener;
  /**
   * Opts in to `localStorage` persistence under this key. Completed step ids
   * are restored on creation (ids of steps that no longer exist are ignored)
   * and saved after every change. Without a key, state is memory-only.
   *
   * Storage is per origin and per browser; it is not synced across devices.
   * Storage failures are ignored and the checklist keeps working in memory.
   */
  readonly storageKey?: string;
}

export interface ChecklistController {
  /**
   * Marks a step as complete. Returns `true` if the state changed, `false` if
   * the step was already complete (no notification is sent).
   * @throws {Error} If `id` is not a step of this checklist.
   */
  complete(id: string): boolean;
  /**
   * Marks a step as not complete. Returns `true` if the state changed, `false`
   * if the step was not complete (no notification is sent).
   * @throws {Error} If `id` is not a step of this checklist.
   */
  uncomplete(id: string): boolean;
  /**
   * Marks every step as not complete. Returns `true` if the state changed,
   * `false` if nothing was complete (no notification is sent).
   */
  reset(): boolean;
  /**
   * Invokes the step's `onClick` callback, if any. Never changes completion.
   * @throws {Error} If `id` is not a step of this checklist.
   */
  click(id: string): void;
  /**
   * Whether a step is complete.
   * @throws {Error} If `id` is not a step of this checklist.
   */
  isCompleted(id: string): boolean;
  getProgress(): ChecklistProgress;
  /** Returns a fresh snapshot; mutating it does not affect the checklist. */
  getState(): ChecklistState;
  /**
   * Registers a listener called after every state change, after `onChange`.
   * Returns a function that removes the listener.
   */
  subscribe(listener: ChecklistListener): () => void;
}

/**
 * Creates an independent, DOM-free checklist state controller.
 *
 * Steps start incomplete, unless restored from `storageKey`. Restoring does
 * not trigger `onChange`; read the initial state with `getState()`.
 * @throws {Error} If a step id is empty or duplicated, or `storageKey` is an
 * empty string.
 */
export function createChecklistController(
  options: ChecklistControllerOptions,
): ChecklistController {
  const steps = new Map<string, ChecklistStep>();
  for (const step of options.steps) {
    if (typeof step.id !== 'string' || step.id === '') {
      throw new Error('Checklist step id must be a non-empty string');
    }
    if (steps.has(step.id)) {
      throw new Error(`Duplicate checklist step id: "${step.id}"`);
    }
    steps.set(step.id, { ...step });
  }

  const { onChange, storageKey } = options;
  if (storageKey === '') {
    throw new Error('Checklist storageKey must be a non-empty string');
  }

  const completed = new Set<string>();
  if (storageKey !== undefined) {
    for (const id of loadCompleted(storageKey)) {
      if (steps.has(id)) completed.add(id);
    }
  }
  const listeners = new Set<ChecklistListener>();

  const getStep = (id: string): ChecklistStep => {
    const step = steps.get(id);
    if (!step) throw new Error(`Unknown checklist step id: "${id}"`);
    return step;
  };

  const toStepState = ({ id, label }: ChecklistStep): ChecklistStepState => ({
    id,
    label,
    completed: completed.has(id),
  });

  const getProgress = (): ChecklistProgress => ({
    completed: completed.size,
    total: steps.size,
  });

  const getState = (): ChecklistState => ({
    steps: Array.from(steps.values(), toStepState),
    progress: getProgress(),
  });

  // Called after every change. State is saved before listeners run, so a
  // throwing listener cannot prevent persistence. Listeners registered when
  // the change happened are called in order, even if an earlier one throws;
  // errors are rethrown afterwards so they are not silently swallowed.
  const commit = (): void => {
    if (storageKey !== undefined) saveCompleted(storageKey, completed);
    const state = getState();
    const targets = onChange ? [onChange, ...listeners] : [...listeners];
    const errors: unknown[] = [];
    for (const listener of targets) {
      try {
        listener(state);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      throw new AggregateError(errors, 'Checklist listeners threw errors');
    }
  };

  const controller: ChecklistController = {
    complete(id) {
      getStep(id);
      if (completed.has(id)) return false;
      completed.add(id);
      commit();
      return true;
    },
    uncomplete(id) {
      getStep(id);
      if (!completed.delete(id)) return false;
      commit();
      return true;
    },
    reset() {
      if (completed.size === 0) return false;
      completed.clear();
      commit();
      return true;
    },
    click(id) {
      const step = getStep(id);
      step.onClick?.(toStepState(step), controller);
    },
    isCompleted(id) {
      getStep(id);
      return completed.has(id);
    },
    getProgress,
    getState,
    subscribe(listener) {
      // Wrap so the same function can be subscribed more than once and each
      // unsubscribe removes only its own registration.
      const entry: ChecklistListener = (state) => {
        listener(state);
      };
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
  };

  return controller;
}
