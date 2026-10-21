// The shared setup for the tests on the local Supabase stack: a service-role client and two fresh test
// users made before the tests, and every test match and user removed after them.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hostSubmit } from "@terminal-dusk/host";
import type { HostResult } from "@terminal-dusk/host";
import { afterAll, beforeAll, expect } from "vitest";
import { client, type StackKeys } from "../migrations/localStack.ts";
import { rowsFor } from "../rows.ts";
import type { MatchEventRow } from "../rows.ts";
import type { MatchWrite } from "../store.ts";
import { SupabaseStore } from "../supabaseStore.ts";
import { NOW, ruleset } from "./match.ts";
import { cleanUp, makeUser, newGame, putIn, storedRows, writeOf } from "./stack.ts";
import type { TestUser } from "./stack.ts";

/** What a stack test file works with. `service` can be read once `beforeAll` has run. */
export type StackGame = {
  readonly service: SupabaseClient;
  readonly users: TestUser[];
  readonly matchIds: string[];
  /** A new game between the two test users, its id kept for clean-up, but nothing put in. */
  fresh(): HostResult;
  /** A new game between the two test users, put in at seq 0 with the service role. */
  stored(): Promise<HostResult>;
};

/** Registers the `beforeAll` and `afterAll` of one stack test file; call it inside its `onLocalStack` block. */
export function stackGame(keys: StackKeys): StackGame {
  let service: SupabaseClient | undefined;
  const users: TestUser[] = [];
  const matchIds: string[] = [];

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    users.push(await makeUser(keys, service, "lio"), await makeUser(keys, service, "sae"));
  }, 60_000);

  afterAll(async () => {
    if (service) await cleanUp(service, matchIds, users);
  }, 60_000);

  const game: StackGame = {
    get service() {
      if (!service) throw new Error("the stack test setup has not run yet");
      return service;
    },
    users,
    matchIds,
    fresh() {
      const start = newGame({ lio: users[0]!.id, sae: users[1]!.id });
      matchIds.push(start.record.matchId);
      return start;
    },
    async stored() {
      const start = game.fresh();
      await putIn(game.service, writeOf(start));
      return start;
    },
  };
  return game;
}

/** The host's result for `player`'s answer `body` to the game `start` at seq 0, made at `now`. Fails when refused. */
export function answered(start: HostResult, player: string, body: Record<string, unknown>, now = NOW + 1): HostResult {
  const next = hostSubmit(ruleset, start.record, start.secret, { player, ...body } as never, now);
  if (!next.ok) throw new Error(`the host refused the answer: ${next.error.code}`);
  return next.value;
}

/**
 * Checks that `write` is exactly what is stored: a SupabaseStore `load` gives back its record and secret,
 * the match and view rows are O2's rows for it, there is one secret row, and the event rows are
 * `earlier` followed by the write's own.
 */
export async function expectStoredAs(
  service: SupabaseClient,
  write: MatchWrite,
  earlier: MatchEventRow[],
): Promise<void> {
  const matchId = write.record.matchId;
  expect(await new SupabaseStore(service).load(matchId)).toEqual({ record: write.record, secret: write.secret });
  const rows = rowsFor(write);
  const stored = await storedRows(service, matchId);
  expect(stored.match).toEqual([rows.match]);
  expect(stored.views).toEqual(rows.views);
  expect(stored.events).toEqual([...earlier, ...rows.events]);
  expect(stored.secret).toHaveLength(1);
}
