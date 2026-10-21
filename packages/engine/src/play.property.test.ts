// Property test: in random games with rival and neutral plays, neutral cards drawing from the player's deck
// included, every card is always in exactly one place, a card whose event or points are still waiting on a
// decision is in play, not in the discard pile, every card in play records who picked or played it (#117),
// and no view shows anything from the secret compartment.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { legalAnswers, viewFor } from "./index.ts";
import type { CardId, GameState, Step } from "./index.ts";
import { accepted, asks, choose, setupPlus, sideCard, startGame, withCards } from "./test/game.ts";

const drawPlayer: Step = { op: "drawContingency", side: "player", bind: "n" };
const turnEndDraw: Step = { op: "trigger", hook: "turnEnd", do: [drawPlayer], duration: { kind: "turnEnd" } };
/** Cards with events that wait on a choice, for either side, some of them in the rival's hand; neutral ones draw. */
const rs = withCards(
  sideCard("l2", 2, asks("lio", "l2")),
  sideCard("s2", 3, asks("lio", "s2")),
  sideCard("l9", 1, [choose("a", "lio"), choose("b", "sae")]),
  sideCard("s9", 4, asks("sae", "s9")),
  sideCard("n1", 2, [...asks("lio", "never"), drawPlayer]),
  sideCard("n2", 3, [drawPlayer, turnEndDraw]),
);
const setup = setupPlus({ lio: ["s9"], sae: ["l9"] }, 2, 2);
const everyCard = [...setup.hands.lio, ...setup.hands.sae, ...setup.deck].sort();

const places = (s: GameState): CardId[] =>
  [...s.private.lio.hand, ...s.private.sae.hand, ...s.secret.deck, ...s.public.inPlay, ...s.public.discard].sort();

/** Expects no view to hold the secret compartment, the generator state or a card in the draw pile. */
function expectNoSecrets(s: GameState): void {
  for (const viewer of ["lio", "sae", "spectator"] as const) {
    const view = viewFor(s, viewer);
    expect(Object.keys(view)).not.toContain("secret");
    const text = JSON.stringify(view);
    expect(text).not.toContain(JSON.stringify(s.secret.rng));
    for (const card of s.secret.deck) expect(text).not.toContain(`"${card}"`);
    expect(view.public.contingency).toEqual(s.public.contingency);
  }
}

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
          expect(s.public.inPlayBy).toHaveLength(s.public.inPlay.length);
          expectNoSecrets(s);
          if (s.public.pending.some((x) => x.kind === "yesNo" || x.kind === "rivalEventOrder")) {
            expect(s.public.inPlay.length).toBeGreaterThan(0);
          }
        }
      }),
    );
  });
});
