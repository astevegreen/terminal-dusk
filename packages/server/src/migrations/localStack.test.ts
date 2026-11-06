// When the stack checks must run: in CI with the stack's keys set, a stack that does not answer is a failure, never
// a quiet "did not run". Without keys (CI's jobs that run no stack) or outside CI, they still only say so.
import { describe, expect, it } from "vitest";
import { didNotRun, stackRequired } from "./localStack.ts";

const KEYS = { API_URL: "http://127.0.0.1:54321", ANON_KEY: "anon", SERVICE_ROLE_KEY: "service" };

describe("stackRequired", () => {
  it("is true only in CI with the stack's URL and keys set", () => {
    expect(stackRequired({ CI: "true", ...KEYS })).toBe(true);
    expect(stackRequired({ CI: "1", ...KEYS })).toBe(true);
    expect(stackRequired({ ...KEYS })).toBe(false);
    expect(stackRequired({ CI: "false", ...KEYS })).toBe(false);
    expect(stackRequired({ CI: "", ...KEYS })).toBe(false);
    expect(stackRequired({ CI: "true" })).toBe(false);
    expect(stackRequired({ CI: "true", API_URL: KEYS.API_URL, ANON_KEY: "anon" })).toBe(false);
  });
});

describe("didNotRun", () => {
  it("fails, naming why, when the stack checks are required", () => {
    expect(() => didNotRun("the submit checks", "the stack did not answer", true)).toThrow(
      /the submit checks must run in CI.*the stack did not answer/,
    );
  });

  it("only warns when they are not required", () => {
    const warned: string[] = [];
    const warn = (line: string): void => {
      warned.push(line);
    };
    expect(() => didNotRun("the submit checks", "no keys", false, warn)).not.toThrow();
    expect(warned).toEqual([expect.stringMatching(/^the submit checks: checks did not run: no keys\. /)]);
  });
});
