import { describe, expect, it, vi } from 'vitest';

import { createChecklistController, type ChecklistStep } from '../src/index.js';

const steps: ChecklistStep[] = [
  { id: 'profile', label: 'Complete your profile' },
  { id: 'invite', label: 'Invite a teammate' },
  { id: 'project', label: 'Create a project' },
];

const create = (onChange?: () => void) =>
  createChecklistController(onChange ? { steps, onChange } : { steps });

describe('createChecklistController', () => {
  it('starts with every step incomplete, in definition order', () => {
    const checklist = create();
    expect(checklist.getState()).toEqual({
      steps: [
        { id: 'profile', label: 'Complete your profile', completed: false },
        { id: 'invite', label: 'Invite a teammate', completed: false },
        { id: 'project', label: 'Create a project', completed: false },
      ],
      progress: { completed: 0, total: 3 },
    });
  });

  it('supports an empty checklist', () => {
    const checklist = createChecklistController({ steps: [] });
    expect(checklist.getState()).toEqual({
      steps: [],
      progress: { completed: 0, total: 0 },
    });
    expect(checklist.reset()).toBe(false);
  });

  it('rejects duplicate step ids', () => {
    expect(() =>
      createChecklistController({
        steps: [
          { id: 'a', label: 'A' },
          { id: 'a', label: 'Again' },
        ],
      }),
    ).toThrow('Duplicate checklist step id: "a"');
  });

  it('rejects empty step ids', () => {
    expect(() =>
      createChecklistController({ steps: [{ id: '', label: 'Empty' }] }),
    ).toThrow('non-empty string');
  });

  it('is not affected by later mutation of the input steps', () => {
    const step = { id: 'a', label: 'A' };
    const input = [step];
    const checklist = createChecklistController({ steps: input });
    step.label = 'Changed';
    input.push({ id: 'b', label: 'B' });
    expect(checklist.getState().steps).toEqual([
      { id: 'a', label: 'A', completed: false },
    ]);
  });
});

describe('state transitions', () => {
  it('completes and uncompletes steps and tracks progress', () => {
    const checklist = create();

    expect(checklist.complete('invite')).toBe(true);
    expect(checklist.isCompleted('invite')).toBe(true);
    expect(checklist.getProgress()).toEqual({ completed: 1, total: 3 });

    expect(checklist.complete('profile')).toBe(true);
    expect(checklist.complete('project')).toBe(true);
    expect(checklist.getProgress()).toEqual({ completed: 3, total: 3 });

    expect(checklist.uncomplete('invite')).toBe(true);
    expect(checklist.isCompleted('invite')).toBe(false);
    expect(checklist.getProgress()).toEqual({ completed: 2, total: 3 });
  });

  it('treats repeated actions as no-ops', () => {
    const onChange = vi.fn();
    const checklist = create(onChange);

    expect(checklist.uncomplete('profile')).toBe(false);
    checklist.complete('profile');
    expect(checklist.complete('profile')).toBe(false);
    expect(checklist.getProgress()).toEqual({ completed: 1, total: 3 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('resets every step', () => {
    const onChange = vi.fn();
    const checklist = create(onChange);
    checklist.complete('profile');
    checklist.complete('project');
    onChange.mockClear();

    expect(checklist.reset()).toBe(true);
    expect(checklist.getProgress()).toEqual({ completed: 0, total: 3 });
    expect(onChange).toHaveBeenCalledTimes(1);

    expect(checklist.reset()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('throws for unknown ids without changing state', () => {
    const onChange = vi.fn();
    const checklist = create(onChange);
    const message = 'Unknown checklist step id: "nope"';

    expect(() => checklist.complete('nope')).toThrow(message);
    expect(() => checklist.uncomplete('nope')).toThrow(message);
    expect(() => checklist.isCompleted('nope')).toThrow(message);
    expect(() => {
      checklist.click('nope');
    }).toThrow(message);
    expect(checklist.getProgress()).toEqual({ completed: 0, total: 3 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('returns snapshots that cannot modify state', () => {
    const checklist = create();
    const state = checklist.getState();
    for (const step of state.steps) Object.assign(step, { completed: true });
    expect(checklist.getProgress()).toEqual({ completed: 0, total: 3 });
  });
});

describe('click', () => {
  it('invokes onClick without completing the step', () => {
    const onClick = vi.fn();
    const onChange = vi.fn();
    const checklist = createChecklistController({
      steps: [{ id: 'a', label: 'A', onClick }],
      onChange,
    });

    checklist.click('a');

    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick).toHaveBeenCalledWith(
      { id: 'a', label: 'A', completed: false },
      checklist,
    );
    expect(checklist.isCompleted('a')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lets onClick complete the step explicitly', () => {
    const checklist = createChecklistController({
      steps: [
        {
          id: 'a',
          label: 'A',
          onClick: (step, list) => list.complete(step.id),
        },
      ],
    });
    checklist.click('a');
    expect(checklist.isCompleted('a')).toBe(true);
  });

  it('is a no-op for steps without onClick', () => {
    const checklist = create();
    expect(() => {
      checklist.click('profile');
    }).not.toThrow();
    expect(checklist.isCompleted('profile')).toBe(false);
  });
});

describe('change notifications', () => {
  it('calls onChange then subscribers with the new state', () => {
    const calls: string[] = [];
    const checklist = createChecklistController({
      steps,
      onChange: (state) =>
        calls.push(`onChange:${String(state.progress.completed)}`),
    });
    checklist.subscribe((state) =>
      calls.push(`subscriber:${String(state.progress.completed)}`),
    );

    checklist.complete('profile');

    expect(calls).toEqual(['onChange:1', 'subscriber:1']);
  });

  it('stops notifying after unsubscribe', () => {
    const checklist = create();
    const listener = vi.fn();
    const unsubscribe = checklist.subscribe(listener);

    checklist.complete('profile');
    unsubscribe();
    unsubscribe();
    checklist.complete('invite');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('treats each subscription of the same function separately', () => {
    const checklist = create();
    const listener = vi.fn();
    const unsubscribeFirst = checklist.subscribe(listener);
    checklist.subscribe(listener);

    checklist.complete('profile');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribeFirst();
    checklist.complete('invite');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('does not notify listeners added during a notification', () => {
    const checklist = create();
    const late = vi.fn();
    checklist.subscribe(() => checklist.subscribe(late));

    checklist.complete('profile');
    expect(late).not.toHaveBeenCalled();
  });

  it('calls every listener and rethrows a listener error', () => {
    const error = new Error('boom');
    const after = vi.fn();
    const checklist = createChecklistController({
      steps,
      onChange: () => {
        throw error;
      },
    });
    checklist.subscribe(after);

    expect(() => checklist.complete('profile')).toThrow(error);
    expect(after).toHaveBeenCalledOnce();
    expect(checklist.isCompleted('profile')).toBe(true);
  });

  it('aggregates multiple listener errors', () => {
    const checklist = create();
    checklist.subscribe(() => {
      throw new Error('one');
    });
    checklist.subscribe(() => {
      throw new Error('two');
    });

    expect(() => checklist.complete('profile')).toThrow(AggregateError);
  });
});

describe('independent instances', () => {
  it('keeps state and listeners separate', () => {
    const firstListener = vi.fn();
    const first = create();
    const second = create();
    first.subscribe(firstListener);

    first.complete('profile');
    second.complete('invite');
    second.complete('project');

    expect(first.getProgress()).toEqual({ completed: 1, total: 3 });
    expect(second.getProgress()).toEqual({ completed: 2, total: 3 });
    expect(first.isCompleted('invite')).toBe(false);
    expect(second.isCompleted('profile')).toBe(false);
    expect(firstListener).toHaveBeenCalledTimes(1);

    second.reset();
    expect(first.getProgress()).toEqual({ completed: 1, total: 3 });
  });
});
