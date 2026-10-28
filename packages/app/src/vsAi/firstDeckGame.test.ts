import { firstDeckCardName, firstDeckConfig, firstDeckRuleset } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { createLocalMatch } from "../transport/localMatch.ts";
import { createVsAiSession } from "./session.ts";
import { playOut } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";

const clock = (): number => 1_700_000_000_000;

describe("a game against the AI with the real first deck", () => {
  for (const human of ["lio", "sae"] as const) {
    it(`playing as ${human.toUpperCase()}, the human and the AI finish a game with the Era 1 cards`, async () => {
      const standIn = standInAi();
      const session = createVsAiSession({
        human,
        gameSeed: "first-deck-seed",
        aiSeed: 5,
        clock,
        makeAi: standIn.makeAi,
        ruleset: firstDeckRuleset,
        makeMatch: (seed, now) => createLocalMatch(firstDeckRuleset, firstDeckConfig(), seed, now),
        label: firstDeckCardName,
      });
      expect(session.getSnapshot().refusal).toBeNull();
      await playOut(session, standIn);
      const snapshot = session.getSnapshot();
      expect(snapshot.aiRefusal).toBeNull();
      expect(snapshot.frame?.view.public.status.kind).toBe("over");
      // The log names real Era 1 cards by their names, not the developer fixture's "t1" to "t16" or raw ids.
      const log = snapshot.log.join("\n");
      const era1Names = firstDeckConfig().setup.deck.map(firstDeckCardName);
      expect(era1Names.some((name) => log.includes(name))).toBe(true);
      expect(log).not.toMatch(/Test card|e1-/);
    });
  }
});
