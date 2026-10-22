// supabaseEmailOf against a stand-in client: the player's address through the Auth admin API, or null when the
// user has none or is not found. Nothing it does is logged, and no error it throws shows the address.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EmailLookupError, supabaseEmailOf } from "./supabaseEmailOf.ts";
import { shown, thrown } from "./test/errors.ts";

type AuthAnswer = {
  data: { user: { id: string; email?: string } | null };
  error: { status?: number; code?: string; message?: string } | null;
};
const PLAYER = "00000000-0000-4000-8000-00000000a11c";
const ADDRESS = "alice@example.test";
const FAKE_KEY = "service-key-that-must-not-leak";

/** A stand-in client whose Auth admin `getUserById` gives `answer` (or throws), keeping each id it was asked for. */
function fakeClient(answer: AuthAnswer | "throws") {
  const asked: string[] = [];
  const db = {
    auth: {
      admin: {
        getUserById: async (id: string) => {
          asked.push(id);
          if (answer === "throws") throw new Error(`fetch failed with key ${FAKE_KEY} for ${ADDRESS}`);
          return answer;
        },
      },
    },
  };
  return { db: db as unknown as SupabaseClient, asked };
}

const found = (email?: string): AuthAnswer => ({
  data: { user: email === undefined ? { id: PLAYER } : { id: PLAYER, email } },
  error: null,
});
const failed = (status: number, code: string): AuthAnswer => ({
  data: { user: null },
  error: { status, code, message: `lookup of ${ADDRESS} failed` },
});

// Every console method is replaced while a test runs, so a test can prove nothing was logged.
type Console = Record<string, unknown>;
const consoleOf = (globalThis as unknown as { console: Console }).console;
const METHODS = ["log", "info", "warn", "error", "debug", "trace"];
let logged: unknown[][] = [];
let saved: Console = {};
beforeEach(() => {
  logged = [];
  saved = Object.fromEntries(METHODS.map((m) => [m, consoleOf[m]]));
  for (const m of METHODS) consoleOf[m] = (...args: unknown[]) => logged.push(args);
});
afterEach(() => {
  Object.assign(consoleOf, saved);
});

describe("supabaseEmailOf", () => {
  it("gives the player's email from the Auth admin API, asking for that player's id", async () => {
    const { db, asked } = fakeClient(found(ADDRESS));
    expect(await supabaseEmailOf(db)(PLAYER)).toBe(ADDRESS);
    expect(asked).toEqual([PLAYER]);
    expect(logged).toEqual([]);
  });

  it.each([
    ["has no email", found()],
    ["has an empty email", found("")],
    ["is not found", failed(404, "user_not_found")],
  ])("gives null when the user %s", async (_name, answer) => {
    expect(await supabaseEmailOf(fakeClient(answer).db)(PLAYER)).toBeNull();
    expect(logged).toEqual([]);
  });

  it("gives null for a player id that is not a user id, without asking", async () => {
    const { db, asked } = fakeClient(found(ADDRESS));
    expect(await supabaseEmailOf(db)("not-a-user-id")).toBeNull();
    expect(asked).toEqual([]);
  });

  it.each([
    ["an Auth error", failed(500, "unexpected_failure")],
    ["a client that throws", "throws" as const],
  ])("rejects on %s with an error that shows no address, key or Auth message, and logs nothing", async (_n, answer) => {
    const error = await thrown(() => supabaseEmailOf(fakeClient(answer).db)(PLAYER));
    expect(error).toBeInstanceOf(EmailLookupError);
    const text = shown(error);
    for (const hidden of [ADDRESS, FAKE_KEY, "lookup of", PLAYER]) expect(text).not.toContain(hidden);
    if (answer !== "throws") expect(text).toContain("unexpected_failure");
    expect(logged).toEqual([]);
  });
});
