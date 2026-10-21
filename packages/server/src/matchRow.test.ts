import type { MatchRecord } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { matchRowFor, recordFromRow } from "./matchRow.ts";
import { rowsFor } from "./rows.ts";
import { playGame, STRATEGIES } from "./test/games.ts";
import { created, MATCH, SEED } from "./test/match.ts";

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
