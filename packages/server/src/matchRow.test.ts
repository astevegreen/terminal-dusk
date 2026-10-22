import { hostSubmit } from "@terminal-dusk/host";
import type { MatchRecord } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { matchRowFor, recordFromRow } from "./matchRow.ts";
import { rowsFor } from "./rows.ts";
import { createdWithClock, DAY } from "./test/deadlines.ts";
import { playGame, STRATEGIES } from "./test/games.ts";
import { created, MATCH, NOW, ruleset, SEED } from "./test/match.ts";

/** The record once a game is over (LIO resigns after its opening pick). */
async function finishedRecord(): Promise<MatchRecord> {
  let last: MatchRecord | null = null;
  await playGame(STRATEGIES[2]!, async ({ store }) => {
    last = (await store.load(MATCH))!.record;
  });
  if (!last) throw new Error("the game left no record");
  return last;
}

describe("the match row and MatchRecord mapping", () => {
  it("an active game's record turned into a row and back is deep-equal, with a null seed column", () => {
    const record = created().record;
    expect(record.status.kind).toBe("active");
    expect("seed" in record).toBe(false);
    const row = matchRowFor(record);
    expect(row.seed).toBeNull();
    const back = recordFromRow(row);
    expect(back).toEqual(record);
    expect("seed" in back).toBe(false);
  });

  it("a finished game's record turned into a row and back is deep-equal, with the seed present", async () => {
    const record = await finishedRecord();
    expect(record.status.kind).not.toBe("active");
    expect(record.seed).toBe(SEED);
    const row = matchRowFor(record);
    expect(row.seed).toBe(SEED);
    expect(recordFromRow(row)).toEqual(record);
  });

  it("a match with a clock writes the clock as is and its earliest deadline, and reads the clock back", () => {
    const record = createdWithClock(MATCH, "graceThenLoss", NOW).record;
    expect(record.clock).toBeDefined();
    const row = matchRowFor(record);
    expect(row.clock).toEqual(record.clock);
    expect(row.next_deadline).toBe(NOW + DAY);
    expect(recordFromRow(row)).toEqual(record);
  });

  it("the next deadline is the earliest one that is set, when only one side is waited on", () => {
    const base = createdWithClock(MATCH, "lossOnTime", NOW).record;
    const record: MatchRecord = { ...base, clock: { ...base.clock!, deadlines: { lio: null, sae: NOW + 5 } } };
    expect(matchRowFor(record).next_deadline).toBe(NOW + 5);
    const early: MatchRecord = { ...base, clock: { ...base.clock!, deadlines: { lio: NOW + 3, sae: NOW + 9 } } };
    expect(matchRowFor(early).next_deadline).toBe(NOW + 3);
  });

  it("a finished match with a clock keeps its clock but has no next deadline", () => {
    const start = createdWithClock(MATCH, "lossOnTime", NOW);
    const over = hostSubmit(ruleset, start.record, start.secret, { player: "alice", resign: true }, NOW + 1);
    if (!over.ok) throw new Error(`resigning was refused: ${over.error.code}`);
    const record = over.value.record;
    expect(record.status.kind).not.toBe("active");
    const row = matchRowFor(record);
    expect(row.clock).toEqual(record.clock);
    expect(row.next_deadline).toBeNull();
    expect(recordFromRow(row)).toEqual(record);
  });

  it("a match without a clock has null clock and next deadline columns, and reads back with no clock field", () => {
    const record = created().record;
    const row = matchRowFor(record);
    expect(row.clock).toBeNull();
    expect(row.next_deadline).toBeNull();
    const back = recordFromRow(row);
    expect("clock" in back).toBe(false);
    expect(back).toEqual(record);
  });

  it("is the same match row O2's rowsFor writes", () => {
    const { record, frames } = created();
    expect(matchRowFor(record)).toEqual(rowsFor({ record, frames }).match);
  });

  it("shares nothing with its input, so changing the result leaves the input alone", () => {
    const record = created().record;
    const before = JSON.parse(JSON.stringify(record)) as MatchRecord;
    const row = matchRowFor(record);
    (row.status as { kind: string }).kind = "changed";
    const back = recordFromRow(matchRowFor(record));
    (back.status as { kind: string }).kind = "changed";
    expect(record).toEqual(before);
  });
});
