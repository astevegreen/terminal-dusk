// The commit_match migration (supabase/migrations/20261021000000_commit_match.sql) on the local Supabase stack.
// `pnpm test:migrations` applies every migration to an empty database first. Only the service role may run the
// function: a signed-out client and a signed-in player of the match are both refused, and nothing changes.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { rowsFor } from "../rows.ts";
import { bodyFor } from "../test/match.ts";
import { onLocalStack, storedRows } from "../test/stack.ts";
import type { Stored } from "../test/stack.ts";
import { answered, stackGame } from "../test/stackGame.ts";
import { client } from "./localStack.ts";

const PERMISSION_DENIED = "42501";

await onLocalStack("commit_match migration on the local Supabase stack", (keys) => {
  const game = stackGame(keys);

  it.each(["signed-out client", "signed-in player of the match"] as const)(
    "a %s may not run commit_match, and a re-read with the service role shows nothing changed",
    async (who) => {
      const start = await game.stored();
      const matchId = start.record.matchId;
      const before: Stored = await storedRows(game.service, matchId);

      const next = answered(start, game.users[0]!.id, bodyFor(0, start.secret, "lio"));
      const rows = rowsFor(next);
      const caller = who === "signed-out client" ? client(keys.url, keys.anonKey) : game.users[0]!.db;
      const { data, error } = await caller.rpc("commit_match", {
        p_match_id: matchId,
        p_expected_seq: 0,
        p_match: rows.match,
        p_secret: next.secret,
        p_views: rows.views,
        p_events: rows.events,
      });

      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISSION_DENIED);
      expect(await storedRows(game.service, matchId)).toEqual(before);
    },
    60_000,
  );
});
