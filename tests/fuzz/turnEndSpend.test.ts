// Turn-end-place (#426): random games on the content test map whose cards leave turn-end payments behind, played
// with every check on every step. checkTriggers (expiryChecks.ts) fails a game that asks for an action menu or a
// realignment once the turnEnd hook has fired; this suite makes sure such payments really happen and get placed.
import { scenarioSetup, TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import type { Ruleset, Side, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { deepFreeze } from "./deepFreeze.ts";
import { gameCount, playGame, randomChooser, randomGame, ruleset } from "./play.ts";
import type { Chooser } from "./play.ts";
import { seededRng } from "./random.ts";

// tests/ has no Node type definitions; this is the one Node global the suite reads.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };

// Capped, as influence.test.ts is: map games run every check and take longer than engine.test.ts's.
const GAMES = Math.min(gameCount(process.env["FUZZ_GAMES"]), 200);

/** Card `i`'s turn-end payment, on every third card: 1 or 2 points, for LIO or SAE in turn. */
function paymentOf(i: number): Step[] {
  if (i % 3 !== 1) return [];
  const k = Math.floor(i / 3);
  const side: Side = k % 2 === 0 ? "lio" : "sae";
  const reaction: Step = { op: "spendPoints", side, amount: 1 + (Math.floor(k / 2) % 2) };
  return [{ op: "trigger", hook: "turnEnd", do: [reaction], duration: { kind: "turnEnd" } }];
}

/** TEST-ONLY FIXTURES: the fuzz cards, each with its turn-end payment, if any, after its own effect. */
const paymentRuleset: Ruleset = deepFreeze({
  id: "fuzz-turn-end-payments",
  cards: ruleset.cards.map((card, i) => ({ ...card, effect: [...card.effect, ...paymentOf(i)] })),
});

describe("turn-end payment fuzz games (#426)", () => {
  it(`plays ${GAMES} map games with turn-end payments to the end, every check at every step, and the payments place influence`, () => {
    let placedAtTurnEnd = 0;
    for (let game = 1; game <= GAMES; game++) {
      const rng = seededRng(game);
      const { setup, seed } = randomGame(rng, game);
      const random = randomChooser(paymentRuleset, rng);
      const counting: Chooser = (state) => {
        const asked = state.public.pending.some((d) => d.kind === "placeInfluence");
        if (state.public.turnEndFired && asked) placedAtTurnEnd++;
        return random(state);
      };
      const map = scenarioSetup(TEST_MAP_SCENARIO).map!;
      const { final } = playGame(paymentRuleset, `Turn-end payment game ${game}`, { ...setup, map }, seed, counting);
      expect(final.public.status.kind).toBe("over");
    }
    expect(placedAtTurnEnd).toBeGreaterThan(0);
  }, // The same limit as influence.test.ts's map games, also capped at 200.
  120_000);
});
