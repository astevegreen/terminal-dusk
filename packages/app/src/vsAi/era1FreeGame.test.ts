import { era1FreeConfig, firstDeckCardName, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { createLocalMatch } from "../transport/localMatch.ts";
import { createVsAiSession } from "./session.ts";
import { playOut } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";

const clock = (): number => 1_700_000_000_000;

describe("the free Era 1 game against the AI (L12)", () => {
  for (const human of ["lio", "sae"] as const) {
    it(`playing as ${human.toUpperCase()}, a game runs 3 turns on Era 1's cards and ends`, async () => {
      const standIn = standInAi();
      const session = createVsAiSession({
        human,
        gameSeed: "era-1-free-seed",
        aiSeed: 5,
        clock,
        makeAi: standIn.makeAi,
        ruleset: firstDeckRuleset,
        makeMatch: (seed, now) => createLocalMatch(firstDeckRuleset, era1FreeConfig(), seed, now),
        label: firstDeckCardName,
      });
      expect(session.getSnapshot().refusal).toBeNull();
      await playOut(session, standIn);
      const snapshot = session.getSnapshot();
      expect(snapshot.aiRefusal).toBeNull();
      const { status, turn } = snapshot.frame!.view.public;
      expect(status.kind).toBe("over");
      expect(turn).toBeLessThanOrEqual(3);
      const era1Names = era1FreeConfig().setup.deck.map(firstDeckCardName);
      expect(era1Names.some((name) => snapshot.log.join("\n").includes(name))).toBe(true);
    });
  }
});
