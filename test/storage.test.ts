import { afterEach, describe, expect, it, vi } from 'vitest';

import { createChecklistController, type ChecklistStep } from '../src/index.js';

const steps: ChecklistStep[] = [
  { id: 'profile', label: 'Complete your profile' },
  { id: 'invite', label: 'Invite a teammate' },
  { id: 'project', label: 'Create a project' },
];

const KEY = 'onboarding';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      data.delete(key);
    }),
  };
}

const install = (storage: object) => {
  vi.stubGlobal('localStorage', storage);
};

const stored = (ids: string[]) => JSON.stringify({ v: 1, completed: ids });

const completedIds = (
  checklist: ReturnType<typeof createChecklistController>,
) =>
  checklist
    .getState()
    .steps.filter((step) => step.completed)
    .map((step) => step.id);

const defineThrowingLocalStorage = (onAccess: () => never) => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: onAccess,
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('opt-in', () => {
  it('never touches storage without a storageKey', () => {
    const storage = fakeStorage({ [KEY]: stored(['profile']) });
    install(storage);

    const checklist = createChecklistController({ steps });
    checklist.complete('invite');
    checklist.reset();

    expect(completedIds(checklist)).toEqual([]);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('rejects an empty storageKey', () => {
    expect(() => createChecklistController({ steps, storageKey: '' })).toThrow(
      'storageKey must be a non-empty string',
    );
  });

  it('does not access localStorage on module import', async () => {
    const access = vi.fn<() => never>(() => {
      throw new Error('accessed');
    });
    defineThrowingLocalStorage(access);
    vi.resetModules();

    await import('../src/index.js');

    expect(access).not.toHaveBeenCalled();
  });
});

describe('restoring', () => {
  it('restores completed steps without notifying or writing', () => {
    const storage = fakeStorage({ [KEY]: stored(['invite', 'project']) });
    install(storage);
    const onChange = vi.fn();

    const checklist = createChecklistController({
      steps,
      storageKey: KEY,
      onChange,
    });

    expect(completedIds(checklist)).toEqual(['invite', 'project']);
    expect(checklist.getProgress()).toEqual({ completed: 2, total: 3 });
    expect(onChange).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('round-trips through a new controller with the same key', () => {
    install(fakeStorage());
    const first = createChecklistController({ steps, storageKey: KEY });
    first.complete('profile');
    first.complete('project');

    const second = createChecklistController({ steps, storageKey: KEY });
    expect(completedIds(second)).toEqual(['profile', 'project']);
  });

  it('ignores stored ids for steps that no longer exist', () => {
    const storage = fakeStorage({ [KEY]: stored(['removed', 'invite']) });
    install(storage);

    const checklist = createChecklistController({ steps, storageKey: KEY });
    expect(completedIds(checklist)).toEqual(['invite']);
    expect(checklist.getProgress()).toEqual({ completed: 1, total: 3 });

    checklist.complete('profile');
    expect(storage.data.get(KEY)).toBe(stored(['invite', 'profile']));
  });

  it('keeps separate keys independent', () => {
    install(fakeStorage());
    const a = createChecklistController({ steps, storageKey: 'a' });
    const b = createChecklistController({ steps, storageKey: 'b' });
    a.complete('profile');
    b.complete('invite');
    b.complete('project');
    a.reset();

    expect(
      completedIds(createChecklistController({ steps, storageKey: 'a' })),
    ).toEqual([]);
    expect(
      completedIds(createChecklistController({ steps, storageKey: 'b' })),
    ).toEqual(['invite', 'project']);
  });

  it.each([
    ['non-JSON', '{not json'],
    ['JSON null', 'null'],
    ['a bare array', '["profile"]'],
    ['a string', '"profile"'],
    ['a missing version', JSON.stringify({ completed: ['profile'] })],
    ['an unknown version', JSON.stringify({ v: 2, completed: ['profile'] })],
    ['a non-array completed', JSON.stringify({ v: 1, completed: 'profile' })],
  ])('starts empty when stored data is %s', (_, raw) => {
    install(fakeStorage({ [KEY]: raw }));
    const checklist = createChecklistController({ steps, storageKey: KEY });
    expect(completedIds(checklist)).toEqual([]);
  });

  it('skips non-string entries', () => {
    install(
      fakeStorage({
        [KEY]: JSON.stringify({ v: 1, completed: ['profile', 1, null, {}] }),
      }),
    );
    const checklist = createChecklistController({ steps, storageKey: KEY });
    expect(completedIds(checklist)).toEqual(['profile']);
  });
});

describe('saving', () => {
  it('saves after complete, uncomplete and reset', () => {
    const storage = fakeStorage();
    install(storage);
    const checklist = createChecklistController({ steps, storageKey: KEY });

    checklist.complete('profile');
    expect(storage.data.get(KEY)).toBe(stored(['profile']));
    checklist.complete('invite');
    expect(storage.data.get(KEY)).toBe(stored(['profile', 'invite']));
    checklist.uncomplete('profile');
    expect(storage.data.get(KEY)).toBe(stored(['invite']));
    checklist.reset();
    expect(storage.data.get(KEY)).toBe(stored([]));
  });

  it('does not write for no-op actions or clicks', () => {
    const storage = fakeStorage();
    install(storage);
    const checklist = createChecklistController({ steps, storageKey: KEY });

    checklist.uncomplete('profile');
    checklist.reset();
    checklist.click('profile');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('saves before notifying, even if a listener throws', () => {
    const storage = fakeStorage();
    install(storage);
    const checklist = createChecklistController({
      steps,
      storageKey: KEY,
      onChange: () => {
        expect(storage.data.get(KEY)).toBe(stored(['profile']));
        throw new Error('listener failed');
      },
    });

    expect(() => checklist.complete('profile')).toThrow('listener failed');
    expect(storage.data.get(KEY)).toBe(stored(['profile']));
  });
});

describe('storage failures', () => {
  const exercise = () => {
    const onChange = vi.fn();
    const checklist = createChecklistController({
      steps,
      storageKey: KEY,
      onChange,
    });
    expect(completedIds(checklist)).toEqual([]);
    expect(checklist.complete('profile')).toBe(true);
    expect(checklist.uncomplete('profile')).toBe(true);
    expect(checklist.complete('invite')).toBe(true);
    expect(checklist.reset()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(4);
  };

  it('works in memory when localStorage is undefined', () => {
    vi.stubGlobal('localStorage', undefined);
    exercise();
  });

  it('works in memory when accessing localStorage throws', () => {
    defineThrowingLocalStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    exercise();
  });

  it('works in memory when getItem and setItem throw', () => {
    const storage = fakeStorage();
    storage.getItem.mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    storage.setItem.mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    install(storage);
    exercise();
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('keeps in-memory state when a write fails', () => {
    const storage = fakeStorage();
    storage.setItem.mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    install(storage);
    const checklist = createChecklistController({ steps, storageKey: KEY });

    checklist.complete('profile');
    expect(checklist.isCompleted('profile')).toBe(true);
  });
});
