// The rehearsal's "did not run" test fails in CI when the stack's keys are set, like packages/server's stack tests:
// a stack that does not answer there is a failure, never a quiet pass.
import { describe, expect, it } from "vitest";
import { didNotRun, stackRequired } from "./test/localStack.ts";

const KEYS = { API_URL: "http://127.0.0.1:54321", ANON_KEY: "anon", SERVICE_ROLE_KEY: "service" };

describe("the rehearsal's stack requirement", () => {
  it("is required only in CI with the stack's URL and keys set", () => {
    expect(stackRequired({ CI: "true", ...KEYS })).toBe(true);
    expect(stackRequired({ ...KEYS })).toBe(false);
    expect(stackRequired({ CI: "false", ...KEYS })).toBe(false);
    expect(stackRequired({ CI: "true" })).toBe(false);
  });

  it("fails when required, and only warns otherwise", () => {
    expect(() => didNotRun("the rehearsal", "the stack did not answer", true)).toThrow(/must run in CI/);
    const warned: string[] = [];
    didNotRun("the rehearsal", "no keys", false, (line) => warned.push(line));
    expect(warned).toEqual([expect.stringMatching(/^the rehearsal: did not run: no keys\. /)]);
  });
});
