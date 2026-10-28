// A game against the AI on the six-region map (A14, issue #439): the first deck on that map, played to its end
// from either side with the human pressing the first button and the Easy AI answering.
import { firstDeckCardName, firstDeckRuleset, sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { createLocalMatch } from "../transport/localMatch.ts";
import { createVsAiSession } from "./session.ts";
import { playOut } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";

const clock = (): number => 1_700_000_000_000;

describe("a game against the AI on the six-region map", () => {
  for (const human of ["lio", "sae"] as const) {
    it(`playing as ${human.toUpperCase()}, starts on the 42-country map and the Easy AI plays it to the end`, async () => {
      const standIn = standInAi();
      const session = createVsAiSession({
        human,
        gameSeed: `six-region-${human}`,
        aiSeed: 7,
        clock,
        makeAi: standIn.makeAi,
        ruleset: firstDeckRuleset,
        makeMatch: (seed, now) => createLocalMatch(firstDeckRuleset, sixRegionMapConfig(), seed, now),
        label: firstDeckCardName,
      });
      expect(session.getSnapshot().refusal).toBeNull();
      expect(session.getSnapshot().frame?.view.public.map?.countries).toHaveLength(42);
      await playOut(session, standIn);
      const snapshot = session.getSnapshot();
      expect(snapshot.aiRefusal).toBeNull();
      expect(snapshot.frame?.view.public.status.kind).toBe("over");
      expect(standIn.answers.length).toBeGreaterThan(0);
    });
  }
});
