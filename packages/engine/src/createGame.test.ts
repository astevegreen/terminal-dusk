import { describe, expect, it } from "vitest";
import { createGame, SIDES } from "./index.ts";
import type { GameState, Setup } from "./index.ts";
import { seedRng } from "./rng.ts";
import { deepFreeze } from "./test/deepFreeze.ts";

const ruleset = { id: "test-ruleset" };
const makeSetup = (): Setup => ({
  seedHash: "abc123",
  hands: { lio: ["c1", "c2"], sae: ["c3"] },
  deck: ["c4", "c5", "c6"],
});
const build = (seed = "seed-1"): GameState => {
  const r = createGame(ruleset, makeSetup(), seed);
  if (!r.ok) throw new Error("expected ok");
  return r.value.state;
};
const numbers = (v: unknown): number[] =>
  typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(numbers) : [];

describe("createGame", () => {
  it("SIDES lists lio then sae", () => {
    expect(SIDES).toEqual(["lio", "sae"]);
  });
  it("copies hands and deck in the order given, with turn 1, seq 0, empty discard", () => {
    const s = build();
    expect(s.private.lio.hand).toEqual(["c1", "c2"]);
    expect(s.private.sae.hand).toEqual(["c3"]);
    expect(s.secret.deck).toEqual(["c4", "c5", "c6"]);
    expect(s.public).toEqual({ turn: 1, discard: [] });
    expect(s.meta).toEqual({ ruleset: "test-ruleset", seedHash: "abc123", seq: 0 });
  });
  it("seeds the rng from the seed and returns no events", () => {
    const r = createGame(ruleset, makeSetup(), "seed-1");
    expect(r.ok && r.value.events).toEqual([]);
    expect(build().secret.rng).toEqual(seedRng("seed-1"));
  });
  it("an empty seed returns invalidSeed", () => {
    const r = createGame(ruleset, makeSetup(), "");
    expect(r).toMatchObject({ ok: false, error: { code: "invalidSeed" } });
  });
  it("a missing or empty seedHash returns invalidSetup", () => {
    const empty = { ...makeSetup(), seedHash: "" };
    expect(createGame(ruleset, empty, "s")).toMatchObject({ ok: false, error: { code: "invalidSetup" } });
    const missing: Partial<Setup> = makeSetup();
    delete missing.seedHash;
    expect(createGame(ruleset, missing as Setup, "s")).toMatchObject({
      ok: false,
      error: { code: "invalidSetup" },
    });
  });
  it("stores the seed string nowhere in the state", () => {
    expect(JSON.stringify(build("zQ-distinctive-seed-9917"))).not.toContain("zQ-distinctive-seed-9917");
  });
  it("does not change deep-frozen inputs", () => {
    const setup = deepFreeze(makeSetup());
    const rs = deepFreeze({ ...ruleset });
    expect(createGame(rs, setup, "seed-1").ok).toBe(true);
  });
  it("state survives a JSON round trip unchanged", () => {
    const s = build();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it("every number in the state is an integer", () => {
    for (const n of numbers(build())) expect(Number.isInteger(n)).toBe(true);
  });
});
