// Reading the match row's clock (#605): a clock under any of the three deadline rules is read, and a bad one is not.
import { describe, expect, it } from "vitest";
import type { FetchLike } from "../transport/remoteHttp.ts";
import { readClock } from "./matchClock.ts";

const clockOf = (rule: string) => ({
  rule,
  days: 3,
  deadlines: { lio: 1_000, sae: null },
  graceUsed: { lio: false, sae: false },
});

const endpoint = (clock: unknown) => {
  const fetch: FetchLike = () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ clock }]) } as Awaited<
      ReturnType<FetchLike>
    >);
  return { url: "http://x", anonKey: "k", matchId: "m1", fetch };
};

describe("readClock reads the clock of each deadline rule", () => {
  for (const rule of ["lossOnTime", "graceThenLoss", "defaultAnswer"])
    it(`reads a ${rule} clock as it is`, async () => {
      expect(await readClock(endpoint(clockOf(rule)), null)).toEqual(clockOf(rule));
    });

  it("returns undefined for a clock with an unknown rule", async () => {
    expect(await readClock(endpoint(clockOf("somethingElse")), null)).toBeUndefined();
  });

  it("returns null for a match without a clock", async () => {
    expect(await readClock(endpoint(null), null)).toBeNull();
  });
});
