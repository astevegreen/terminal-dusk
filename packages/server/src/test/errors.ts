// Test helpers for checking what a thrown storage error shows.

/** Everything a thrown error shows: its name, message, any fields it carries and its cause. */
export const shown = (e: unknown): string =>
  e instanceof Error ? `${e.name} ${e.message} ${JSON.stringify(e)} ${String(e.cause ?? "")}` : String(e);

/** What `call` threw or rejected with. Fails when it did neither. */
export async function thrown(call: () => Promise<unknown>): Promise<unknown> {
  try {
    await call();
  } catch (e) {
    return e;
  }
  throw new Error("expected the call to throw or reject");
}
