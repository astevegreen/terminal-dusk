import { firstDeckCardName, firstDeckRuleset, scenario2025To2027Config } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { createLocalMatch } from "../transport/localMatch.ts";
import { createVsAiSession } from "./session.ts";
import { playOut } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";

const clock = (): number => 1_700_000_000_000;

describe("the 2025-2027 game against the AI (#601)", () => {
  for (const human of ["lio", "sae"] as const) {
    it(`playing as ${human.toUpperCase()}, a game runs 11 turns and ends`, async () => {
      const standIn = standInAi();
      const session = createVsAiSession({
        human,
        gameSeed: "2025-2027-seed",
        aiSeed: 5,
        clock,
        makeAi: standIn.makeAi,
        ruleset: firstDeckRuleset,
        makeMatch: (seed, now) => createLocalMatch(firstDeckRuleset, scenario2025To2027Config(), seed, now),
        label: firstDeckCardName,
      });
      expect(session.getSnapshot().refusal).toBeNull();
      await playOut(session, standIn);
      const snapshot = session.getSnapshot();
      expect(snapshot.aiRefusal).toBeNull();
      const { status, turn } = snapshot.frame!.view.public;
      expect(status.kind).toBe("over");
      expect(turn).toBeLessThanOrEqual(11);
    }, 60_000);
  }
});
