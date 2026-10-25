// The `storage` part of the Platform interface (docs/architecture.md, Decision 7): a small async key-value
// store, so a Capacitor implementation fits later. No call on these stores ever rejects.

export type KeyValueStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

/** The part of the browser's `Storage` (localStorage) that `webStore` uses. */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** A store that keeps everything in memory, for tests. */
export function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    get: (key) => Promise.resolve(values.get(key) ?? null),
    set: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
    remove: (key) => {
      values.delete(key);
      return Promise.resolve();
    },
  };
}

/**
 * A store over a browser `Storage`. Storage that throws (private mode, blocked storage, a full quota) reads
 * as empty, and a write or removal it refuses is quietly dropped.
 */
export function webStore(storage: StorageLike): KeyValueStore {
  return {
    get: (key) => {
      try {
        return Promise.resolve(storage.getItem(key));
      } catch {
        return Promise.resolve(null);
      }
    },
    set: (key, value) => {
      try {
        storage.setItem(key, value);
      } catch {
        // Nothing to do: the value just is not kept.
      }
      return Promise.resolve();
    },
    remove: (key) => {
      try {
        storage.removeItem(key);
      } catch {
        // Nothing to do: blocked storage kept nothing we could remove.
      }
      return Promise.resolve();
    },
  };
}
