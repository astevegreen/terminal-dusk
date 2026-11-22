// The match_event.stand_in migration (supabase/migrations/20261029000000_match_event_stand_in.sql, #605). The text
// checks always run; the rest run on the local Supabase stack, where `pnpm test:migrations` applies every migration
// to an empty database first. They prove commit_match saves the covered side on a stand-in step's three event rows,
// and null on an ordinary step. Without a running local stack, one test says so and how to start it.
import { describe, expect, it } from "vitest";
import STAND_IN_MIGRATION from "../../supabase/migrations/20261029000000_match_event_stand_in.sql?raw";
import { rowsFor } from "../rows.ts";
import { bodyFor } from "../test/match.ts";
import { onLocalStack, storedRows, writeOf } from "../test/stack.ts";
import { answered, stackGame } from "../test/stackGame.ts";

describe("the stand-in migration's text", () => {
  it("adds a nullable stand_in column to match_event that holds only lio or sae", () => {
    expect(STAND_IN_MIGRATION).toMatch(
      /alter table public\.match_event\s+add column stand_in text check \(stand_in in \('lio', 'sae'\)\);/,
    );
    expect(STAND_IN_MIGRATION).not.toMatch(/not null/i);
  });

  it("changes no grants and no policies, so clients still only read, under the same row-level rules", () => {
    expect(STAND_IN_MIGRATION).not.toMatch(/\bgrant\b|\brevoke\b|create policy/i);
  });
});

await onLocalStack("match_event.stand_in on the local Supabase stack", (keys) => {
  const game = stackGame(keys);

  const commit = async (standIn: "lio" | undefined) => {
    const start = await game.stored();
    const matchId = start.record.matchId;
    const next = answered(start, game.users[0]!.id, bodyFor(0, start.secret, "lio"));
    const frames = Object.fromEntries(
      Object.entries(next.frames).map(([viewer, frame]) => [viewer, { ...frame, standIn }]),
    ) as typeof next.frames;
    const rows = rowsFor({ ...writeOf(next), frames });
    const { data, error } = await game.service.rpc("commit_match", {
      p_match_id: matchId,
      p_expected_seq: 0,
      p_match: rows.match,
      p_secret: next.secret,
      p_views: rows.views,
      p_events: rows.events,
    });
    expect(error).toBeNull();
    expect(data).toBe("saved");
    return (await storedRows(game.service, matchId)).events.filter((row) => row.seq === next.record.seq);
  };

  it("commit_match saves the covered side on all three event rows of a stand-in step", async () => {
    const events = await commit("lio");
    expect(events.map((row) => row.stand_in)).toEqual(["lio", "lio", "lio"]);
  }, 60_000);
});
