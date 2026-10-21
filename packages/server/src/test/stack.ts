// Test helpers for the SupabaseStore checks on the local Supabase stack (O3's localStack.ts finds it).
// Users and matches are made fresh with the service role for each run, and removed afterwards.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HostResult, MatchConfig } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { client, freshId, HOW_TO_START, stackKeys, whyUnavailable, type StackKeys } from "../migrations/localStack.ts";
import { rowsFor } from "../rows.ts";
import type { MatchEventRow, MatchRow, MatchViewRow } from "../rows.ts";
import type { MatchWrite } from "../store.ts";
import { created } from "./match.ts";

/**
 * Runs `define` with the stack's keys when the local stack answers. Otherwise one test says why the
 * checks did not run and how to start the stack, the way O3's migration test does. `probe`, when given, is a
 * further check once the stack answers (an Edge Function being served, say): why it can't be used, or null.
 */
export async function onLocalStack(
  title: string,
  define: (keys: StackKeys) => void,
  probe?: (keys: StackKeys) => Promise<string | null>,
): Promise<void> {
  const keys = stackKeys();
  let unavailable = await whyUnavailable(keys);
  if (unavailable === null && keys !== null && probe) unavailable = await probe(keys);
  if (unavailable === null && keys !== null) {
    describe(title, () => define(keys));
    return;
  }
  describe(title, () => {
    it(`did not run, because ${unavailable} (the warning below says how to start it)`, () => {
      (globalThis as { console?: { warn(m: string): void } }).console?.warn(
        `${title}: checks did not run: ${unavailable}. ${HOW_TO_START} ` +
          "With the stack up, `pnpm test` in packages/server runs these checks too.",
      );
      expect(unavailable).not.toBeNull();
    });
  });
}

/** A signed-in test user: its id and a client signed in as it. */
export type TestUser = { id: string; db: SupabaseClient };

/** Makes and signs in a fresh test user. */
export async function makeUser(keys: StackKeys, service: SupabaseClient, name: string): Promise<TestUser> {
  const email = `${name}-${freshId()}@terminal-dusk.test`;
  const password = freshId();
  const made = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (made.error || !made.data.user) throw new Error(`could not create the ${name} test user: ${made.error?.message}`);
  const db = client(keys.url, keys.anonKey);
  const signedIn = await db.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw new Error(`could not sign in the ${name} test user: ${signedIn.error.message}`);
  return { id: made.data.user.id, db };
}

/** The test user's current access token, as an Edge Function call sends it. */
export async function accessToken(user: TestUser): Promise<string> {
  const { data } = await user.db.auth.getSession();
  if (!data.session) throw new Error("the test user has no session");
  return data.session.access_token;
}

/** A fresh match id for this run. */
export const freshMatchId = (): string => `test-${freshId()}`;

/** A new game made by hostCreate with a fresh id between two players (user ids). */
export const newGame = (players: MatchConfig["players"]): HostResult => created(freshMatchId(), players);

/** The parts of a host result a commit saves. */
export const writeOf = (result: HostResult): MatchWrite => ({
  record: result.record,
  secret: result.secret,
  frames: result.frames,
});

/** Puts in a game just made by hostCreate (seq 0) with the service role: its seq 0 rows from O2's rowsFor, and its secret. */
export async function putIn(service: SupabaseClient, write: MatchWrite): Promise<void> {
  const rows = rowsFor(write);
  const steps: [string, unknown][] = [
    ["match", rows.match],
    ["match_secret", { match_id: rows.match.match_id, secret: write.secret }],
    ["match_view", rows.views],
    ["match_event", rows.events],
  ];
  for (const [table, value] of steps) {
    const { error } = await service.from(table).insert(value as never);
    if (error) throw new Error(`could not put in the ${table} test rows: ${error.code}`);
  }
}

/** Every stored row of a match, in a fixed order, read with the service role. */
export type Stored = {
  match: MatchRow[];
  secret: { match_id: string; secret: unknown }[];
  views: MatchViewRow[];
  events: MatchEventRow[];
};

export async function storedRows(service: SupabaseClient, matchId: string): Promise<Stored> {
  const read = async <T>(table: string, order: string[]): Promise<T[]> => {
    let query = service.from(table).select("*").eq("match_id", matchId);
    for (const column of order) query = query.order(column);
    const { data, error } = await query;
    if (error) throw new Error(`could not read the ${table} test rows: ${error.code}`);
    return data as T[];
  };
  return {
    match: await read<MatchRow>("match", []),
    secret: await read("match_secret", []),
    views: await read<MatchViewRow>("match_view", ["viewer"]),
    events: await read<MatchEventRow>("match_event", ["seq", "viewer"]),
  };
}

/** Removes test matches (their secret, view and event rows go with them) and test users. */
export async function cleanUp(service: SupabaseClient, matchIds: string[], users: TestUser[]): Promise<void> {
  if (matchIds.length > 0) await service.from("match").delete().in("match_id", matchIds);
  for (const user of users) await service.auth.admin.deleteUser(user.id);
}
