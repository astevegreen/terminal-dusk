// Hard rule 5 for the fuzz suite: a state is plain JSON with integers only. And the comparison every check uses,
// which never counts a value that is not plain JSON (NaN, undefined, Infinity, a Map) as equal to anything.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isArrayOrPlain = (v: Record<string, unknown>): boolean =>
  Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null;
/** A JSON scalar: null, a string, a boolean or a finite number. */
const isScalar = (v: unknown): boolean =>
  v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));

/**
 * Where two plain JSON values first differ, as a path starting at `path`, or null if they are equal. A value that
 * is not plain JSON (NaN, undefined, Infinity, a function, a Map or Date) is always a difference, even on both sides.
 */
export function firstDifference(a: unknown, b: unknown, path: string): string | null {
  if (!isObject(a) || !isObject(b)) return isScalar(a) && Object.is(a, b) ? null : path;
  if (!isArrayOrPlain(a) || !isArrayOrPlain(b) || Array.isArray(a) !== Array.isArray(b)) return path;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) return `${path}.${key}`;
    const diff = firstDifference(a[key], b[key], `${path}.${key}`);
    if (diff !== null) return diff;
  }
  return null;
}

/** The path to the first number in `value` that is not a safe whole number, with that number, or null. */
function firstNonInteger(value: unknown, path: string): { path: string; value: number } | null {
  if (typeof value === "number") return Number.isSafeInteger(value) ? null : { path, value };
  if (!isObject(value)) return null;
  for (const [key, inner] of Object.entries(value)) {
    const found = firstNonInteger(inner, `${path}.${key}`);
    if (found !== null) return found;
  }
  return null;
}

/** Hard rule 5: the state survives a JSON round trip unchanged, and every number in it is a safe whole number. */
export function checkPlainJson(state: unknown): void {
  const number = firstNonInteger(state, "state");
  if (number !== null) throw new Error(`${number.path} is ${String(number.value)}, not a whole number`);
  const diff = firstDifference(JSON.parse(JSON.stringify(state)) as unknown, state, "state");
  if (diff !== null) throw new Error(`the state is not plain JSON: ${diff} changes in a JSON round trip`);
}
