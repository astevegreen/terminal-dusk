import type { MatchRecord } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { matchRowFor, recordFromRow } from "./matchRow.ts";
import { submit } from "./submit.ts";
import { created, MATCH, NOW, setup } from "./test/match.ts";

/** A record of a game that is over: LIO resigns at once, so the record carries the seed. */
async function finishedRecord(): Promise<MatchRecord> {
  const { store, deps } = setup();
  const result = await submit(deps, { matchId: MATCH, player: "alice", body: { resign: true }, now: NOW + 1 });
  if (!result.ok) throw new Error(`resign refused: ${result.error.code}`);
  return (await store.load(MATCH))!.record;
}

describe("matchRowFor and recordFromRow: a match row and a MatchRecord, each turned into the other", () => {
  it("an active game's record turned into a row and back is deep-equal, with a null seed column and no seed field", () => {
    const { record } = created();
    expect(record.status.kind).toBe("active");
    const row = matchRowFor(record);
    expect(row.seed).toBeNull();
    const back = recordFromRow(row);
    expect(back).toEqual(record);
    expect("seed" in back).toBe(false);
  });

  it("a finished game's record turned into a row and back is deep-equal, with the seed in both", async () => {
    const record = await finishedRecord();
    expect(record.status.kind).toBe("over");
    expect(record.seed).toBeDefined();
    const row = matchRowFor(record);
    expect(row.seed).toBe(record.seed);
    expect(recordFromRow(row)).toEqual(record);
  });

  it("shares nothing with its input, so changing the result cannot change the original", () => {
    const { record } = created();
    const row = matchRowFor(record);
    expect(row.status).not.toBe(record.status);
    expect(recordFromRow(row).status).not.toBe(row.status);
  });
});
