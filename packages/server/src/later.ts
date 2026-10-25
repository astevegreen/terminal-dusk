// For in-memory ports that answer with a promise but have nothing to wait for.

/**
 * A promise of what `body` returns. `body` runs inside the promise, so when it throws the caller gets a
 * rejected promise, never a throw at the moment of the call (the same as an `async` function).
 */
export const later = <T>(body: () => T): Promise<T> => Promise.resolve().then(body);
