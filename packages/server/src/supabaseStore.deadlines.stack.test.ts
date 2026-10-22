// SupabaseStore's clock on the local Supabase stack: load gives back the clock, `due` finds the due matches
// through the next_deadline column, and `saveClock` updates only the match row, guarded by its seq.
// Without a running local stack, one test says so and how to start it.
import type { HostResult, MatchRecord } from "@terminal-dusk/host";
import { expect, it } from "vitest";
import { matchRowFor } from "./matchRow.ts";
import { SupabaseStore } from "./supabaseStore.ts";
import { createdWithClock, DAY } from "./test/deadlines.ts";
import { bodyFor } from "./test/match.ts";
import { freshMatchId, onLocalStack, putIn, storedRows, writeOf } from "./test/stack.ts";
import { answered, stackGame } from "./test/stackGame.ts";

// Far from the other stack tests' times, so their matches are never due in these checks.
const AT = 4_000_000_000_000;

await onLocalStack("SupabaseStore on the local Supabase stack: the deadline clock", (keys) => {
  const game = stackGame(keys);

  /** A one-day match with `rule` made at `at` between the two test users, put in at seq 0. */
  async function clocked(at: number, rule: "lossOnTime" | "graceThenLoss" = "lossOnTime"): Promise<HostResult> {
    const id = freshMatchId();
    game.matchIds.push(id);
    const start = createdWithClock(id, rule, at, { lio: game.users[0]!.id, sae: game.users[1]!.id });
    await putIn(game.service, writeOf(start));
    return start;
  }

  it("load gives back a match's clock exactly, and a match without one has no clock", async () => {
    const store = new SupabaseStore(game.service);
    const start = await clocked(AT);
    expect(await store.load(start.record.matchId)).toEqual({ record: start.record, secret: start.secret });
    const plain = await game.stored();
    const loaded = await store.load(plain.record.matchId);
    expect(loaded).toEqual({ record: plain.record, secret: plain.secret });
    expect("clock" in loaded!.record).toBe(false);
  }, 60_000);

  it("a commit through commit_match stores the new clock and next deadline", async () => {
    const start = await clocked(AT + 10);
    const next = answered(start, game.users[0]!.id, bodyFor(0, start.secret, "lio"), AT + 11);
    const store = new SupabaseStore(game.service);
    expect(await store.commit(start.record.matchId, 0, writeOf(next))).toBe("saved");
    expect((await store.load(start.record.matchId))!.record).toEqual(next.record);
    expect((await storedRows(game.service, start.record.matchId)).match).toEqual([matchRowFor(next.record)]);
  }, 60_000);

  it("due gives the active matches whose earliest deadline is at or before now, by deadline, then by match id", async () => {
    const store = new SupabaseStore(game.service);
    const base = AT + 1_000_000;
    const first = await clocked(base - 5);
    const tiedA = await clocked(base);
    const tiedB = await clocked(base);
    const notYet = await clocked(base + 1);
    const plain = await game.stored();
    const ids = new Set([first, tiedA, tiedB, notYet, plain].map((r) => r.record.matchId));
    const ours = (due: string[]) => due.filter((id) => ids.has(id));

    const tied = [tiedA.record.matchId, tiedB.record.matchId].sort();
    expect(ours(await store.due(base + DAY))).toEqual([first.record.matchId, ...tied]);
    expect(ours(await store.due(base + DAY - 6))).toEqual([]);
  }, 60_000);

  it("due leaves out a match that is over", async () => {
    const store = new SupabaseStore(game.service);
    const start = await clocked(AT + 2_000_000);
    const over = answered(start, game.users[0]!.id, { resign: true }, AT + 2_000_001);
    expect(await store.commit(start.record.matchId, 0, writeOf(over))).toBe("saved");
    expect(await store.due(AT + 2_000_000 + 10 * DAY)).not.toContain(start.record.matchId);
  }, 60_000);

  it("saveClock updates only the match row's clock, next deadline and updated_at, and no view or event row", async () => {
    const store = new SupabaseStore(game.service);
    const start = await clocked(AT + 3_000_000, "graceThenLoss");
    const matchId = start.record.matchId;
    const before = await storedRows(game.service, matchId);
    const extended: MatchRecord = {
      ...start.record,
      updatedAt: AT + 3_000_000 + DAY,
      clock: {
        ...start.record.clock!,
        deadlines: { lio: AT + 3_000_000 + 2 * DAY, sae: AT + 3_000_000 + DAY },
        graceUsed: { lio: true, sae: false },
      },
    };
    expect(await store.saveClock(matchId, 0, extended)).toBe("saved");

    const after = await storedRows(game.service, matchId);
    expect(after.match).toEqual([matchRowFor(extended)]);
    expect(after.match[0]!.next_deadline).toBe(AT + 3_000_000 + DAY);
    expect(after.views).toEqual(before.views);
    expect(after.events).toEqual(before.events);
    expect(after.secret).toEqual(before.secret);
    expect((await store.load(matchId))!.record).toEqual(extended);
  }, 60_000);

  it("saveClock with a seq that has moved on, or for an unknown match, gives conflict and changes nothing", async () => {
    const store = new SupabaseStore(game.service);
    const start = await clocked(AT + 4_000_000, "graceThenLoss");
    const matchId = start.record.matchId;
    const before = await storedRows(game.service, matchId);
    const changed: MatchRecord = { ...start.record, updatedAt: AT + 4_000_000 + 7 };
    for (const wrong of [1, 5, -1]) expect(await store.saveClock(matchId, wrong, changed)).toBe("conflict");
    expect(await storedRows(game.service, matchId)).toEqual(before);

    const unknown = freshMatchId();
    game.matchIds.push(unknown);
    expect(await store.saveClock(unknown, 0, { ...changed, matchId: unknown })).toBe("conflict");
    expect((await storedRows(game.service, unknown)).match).toEqual([]);
  }, 60_000);
});
