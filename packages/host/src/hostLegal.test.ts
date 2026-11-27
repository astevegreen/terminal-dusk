import { legalAnswers } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hostCreate } from "./hostCreate.ts";
import { hostLegalAnswers } from "./hostLegal.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { makeConfig, NOW, ruleset, SEED } from "./test/match.ts";

describe("hostLegalAnswers (#641)", () => {
  it("gives each side exactly the engine's legal answers to its waiting decision, and none to a side nothing waits for", () => {
    const r = hostCreate(ruleset, makeConfig(), SEED, NOW);
    if (!r.ok) throw new Error(r.error.code);
    const secret = deepFreeze(r.value.secret);
    for (const side of ["lio", "sae"] as const) {
      expect(hostLegalAnswers(ruleset, secret, side)).toEqual(legalAnswers(ruleset, secret.state, side));
    }
    const waiting = (["lio", "sae"] as const).filter((side) => r.value.frames[side].decision !== null);
    expect(waiting.length).toBeGreaterThan(0);
    for (const side of waiting) expect(hostLegalAnswers(ruleset, secret, side).length).toBeGreaterThan(0);
    for (const side of (["lio", "sae"] as const).filter((s) => !waiting.includes(s)))
      expect(hostLegalAnswers(ruleset, secret, side)).toEqual([]);
  });
});
