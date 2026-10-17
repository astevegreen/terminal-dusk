// Freezes a value and everything inside it, so an engine call that changes its input throws.
// A copy of the engine's own test helper: the fuzz suite uses only the engine's public exports.
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
