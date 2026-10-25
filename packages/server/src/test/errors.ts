// Test helpers for checking what a thrown storage error shows.

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

const isPrimitive = (e: unknown): e is Primitive => e === null || (typeof e !== "object" && typeof e !== "function");

/**
 * Everything a thrown error shows: its name, message, any fields it carries and its cause. A cause, or a thrown
 * value, that is an object but not an `Error` is shown by its fields, never as "[object Object]".
 */
export const shown = (e: unknown): string => {
  if (e instanceof Error) return `${e.name} ${e.message} ${JSON.stringify(e)} ${e.cause == null ? "" : shown(e.cause)}`;
  if (isPrimitive(e)) return String(e);
  if (typeof e === "function") return `function ${e.name}`;
  return JSON.stringify(e);
};

/** What `call` threw or rejected with. Fails when it did neither. */
export async function thrown(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected the call to throw or reject");
}
