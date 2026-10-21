// The commit_match migration (supabase/migrations/20261021000000_commit_match.sql) on the local Supabase stack.
// `pnpm test:migrations` applies every migration to an empty database first. Only the service role may run the
// function: a signed-out client and a signed-in player of the match are both refused, and nothing changes.
// Without a running local stack, one test says so and how to start it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hostSubmit } from "@terminal-dusk/host";
import { afterAll, beforeAll, expect, it } from "vitest";
import { rowsFor } from "../rows.ts";
import { bodyFor, NOW, ruleset } from "../test/match.ts";
import { cleanUp, makeUser, newGame, onLocalStack, putIn, storedRows, writeOf } from "../test/stack.ts";
import type { Stored, TestUser } from "../test/stack.ts";
import { client } from "./localStack.ts";

const PERMISSION_DENIED = "42501";

await onLocalStack("commit_match migration on the local Supabase stack", (keys) => {
  let service: SupabaseClient;
  const users: TestUser[] = [];
  const matchIds: string[] = [];

  beforeAll(async () => {
    service = client(keys.url, keys.serviceKey);
    users.push(await makeUser(keys, service, "lio"), await makeUser(keys, service, "sae"));
  }, 60_000);

  afterAll(async () => {
    await cleanUp(service, matchIds, users);
  }, 60_000);

  it.each(["signed-out client", "signed-in player of the match"] as const)(
    "a %s may not run commit_match, and a re-read with the service role shows nothing changed",
    async (who) => {
      const start = newGame({ lio: users[0]!.id, sae: users[1]!.id });
      const matchId = start.record.matchId;
      matchIds.push(matchId);
      await putIn(service, writeOf(start));
      const before: Stored = await storedRows(service, matchId);

      const body = bodyFor(0, start.secret, "lio");
      const next = hostSubmit(ruleset, start.record, start.secret, { player: users[0]!.id, ...body } as never, NOW + 1);
      if (!next.ok) throw new Error(`the host refused the answer: ${next.error.code}`);
      const rows = rowsFor(next.value);
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : users[0]!.db;
      const { data, error } = await caller.rpc("commit_match", {
        p_match_id: matchId,
        p_expected_seq: 0,
        p_match: rows.match,
        p_secret: next.value.secret,
        p_views: rows.views,
        p_events: rows.events,
      });

      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISSION_DENIED);
      expect(await storedRows(service, matchId)).toEqual(before);
    },
    60_000,
  );
});
