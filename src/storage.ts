// localStorage persistence for completed step ids.
//
// Stored format: {"v":1,"completed":["id", ...]}. Every failure (storage
// unavailable or blocked, malformed or unknown-version data, quota errors) is
// non-fatal: reads fall back to "nothing stored" and writes are dropped, so
// the checklist keeps working in memory.

const VERSION = 1;

interface StoredState {
  readonly v: typeof VERSION;
  readonly completed: readonly string[];
}

// Resolved lazily on every call: never touched at module import, and
// accessing `localStorage` itself can throw (e.g. sandboxed iframes, blocked
// cookies).
const getStorage = (): Storage | undefined => {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

/** Returns the stored completed ids, or an empty list if none are usable. */
export function loadCompleted(key: string): string[] {
  try {
    const raw = getStorage()?.getItem(key);
    if (raw == null) return [];
    const data: unknown = JSON.parse(raw);
    if (
      typeof data !== 'object' ||
      data === null ||
      !('v' in data) ||
      data.v !== VERSION ||
      !('completed' in data) ||
      !Array.isArray(data.completed)
    ) {
      return [];
    }
    return data.completed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

/** Stores the completed ids; failures are ignored. */
export function saveCompleted(key: string, completed: Iterable<string>): void {
  try {
    const data: StoredState = { v: VERSION, completed: [...completed] };
    getStorage()?.setItem(key, JSON.stringify(data));
  } catch {
    // Quota exceeded, storage disabled, etc.: keep working in memory.
  }
}
