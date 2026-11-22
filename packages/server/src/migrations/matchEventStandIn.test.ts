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

  it("changes no table grants and no policies, so clients still only read, under the same row-level rules", () => {
    expect(STAND_IN_MIGRATION).not.toMatch(/grant\s+\w+\s+on\s+(table\s+)?public\.match/i);
    expect(STAND_IN_MIGRATION).not.toMatch(/create policy/i);
  });

  it("replaces commit_match so it writes stand_in, and keeps it callable by the service role only", () => {
    expect(STAND_IN_MIGRATION).toMatch(/insert into public\.match_event \(match_id, seq, viewer, events, stand_in\)/);
    expect(STAND_IN_MIGRATION).toMatch(/e\.events, e\.stand_in/);
    expect(STAND_IN_MIGRATION).toMatch(
      /revoke execute on function public\.commit_match\([^)]*\) from public, anon, authenticated;/,
    );
    expect(STAND_IN_MIGRATION).toMatch(/grant execute on function public\.commit_match\([^)]*\) to service_role;/);
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

  it("commit_match saves null on all three event rows of an ordinary step", async () => {
    const events = await commit(undefined);
    expect(events.map((row) => row.stand_in)).toEqual([null, null, null]);
  }, 60_000);
});
