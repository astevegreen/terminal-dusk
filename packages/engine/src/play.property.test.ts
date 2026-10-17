// Property test: in random games with rival and neutral plays, every card is always in exactly one place,
// and a card whose event or points are still waiting on a decision is in play, not in the discard pile.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { legalAnswers } from "./index.ts";
import type { CardId, GameState } from "./index.ts";
import { accepted, asks, choose, setupPlus, sideCard, startGame, withCards } from "./test/game.ts";

/** Cards with events that wait on a choice, for either side, some of them in the rival's hand. */
const rs = withCards(
  sideCard("l2", 2, asks("lio", "l2")),
  sideCard("s2", 3, asks("lio", "s2")),
  sideCard("l9", 1, [choose("a", "lio"), choose("b", "sae")]),
  sideCard("s9", 4, asks("sae", "s9")),
  sideCard("n1", 2, asks("lio", "never")),
);
const setup = setupPlus({ lio: ["s9"], sae: ["l9"] }, 2, 2);
const everyCard = [...setup.hands.lio, ...setup.hands.sae, ...setup.deck].sort();

const places = (s: GameState): CardId[] =>
  [...s.private.lio.hand, ...s.private.sae.hand, ...s.secret.deck, ...s.public.inPlay, ...s.public.discard].sort();

describe("playing cards: every card has one place", () => {
  it("at every step each card is in exactly one place, and while a choice or rivalEventOrder waits a card is in play", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 80 }), (picks) => {
        let s = startGame(2, 2, rs, setup);
        for (const pick of picks) {
          if (s.public.status.kind === "over") break;
          const open = s.public.pending;
          const d = open[pick % open.length]!;
          const legal = legalAnswers(rs, s, d.side);
          s = accepted(s, { decisionId: d.id, side: d.side, value: legal[pick % legal.length]! }, rs);
          expect(places(s)).toEqual(everyCard);
          if (s.public.pending.some((x) => x.kind === "yesNo" || x.kind === "rivalEventOrder")) {
            expect(s.public.inPlay.length).toBeGreaterThan(0);
          }
        }
      }),
    );
  });
});
