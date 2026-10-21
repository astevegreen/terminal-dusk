// Property test (#184): in random games where cards show hands (revealHand), each side's knowledge always
// lists, each once, only cards still in the rival's hand, and reconstruct still rebuilds the state.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { hiddenPart, legalAnswers, reconstruct, viewFor } from "./index.ts";
import { SIDES, otherSide } from "./types.ts";
import type { GameState, Side, Step } from "./types.ts";
import { applied, choose, ifYes, setupPlus, sideCard, startGame, withCards } from "./test/game.ts";

const reveal = (side: Side): Step => ({ op: "revealHand", side });

const rs = withCards(
  sideCard("l1", 2, [reveal("sae")]),
  sideCard("l2", 3, [choose("a", "lio"), ifYes("a", [reveal("sae")])]),
  sideCard("s1", 1, [reveal("lio")]),
  sideCard("s2", 2, [reveal("lio"), reveal("lio")]),
  sideCard("n1", 2, [reveal("lio"), reveal("sae")]),
  sideCard("n2", 3, [reveal("sae")]),
);
const setup = setupPlus({ lio: ["s12"], sae: ["l12"] }, 3, 2);

/** Knowledge holds each card once, every one still in the rival's hand; reconstruct rebuilds the state. */
function checkKnowledge(s: GameState): void {
  for (const side of SIDES) {
    const known = s.private[side].knowledge;
    expect(new Set(known).size).toBe(known.length);
    for (const card of known) expect(s.private[otherSide(side)].hand).toContain(card);
    expect(reconstruct(viewFor(s, side), hiddenPart(s, side))).toStrictEqual(s);
  }
}

describe("knowledge: always a subset of the rival's current hand", () => {
  it("after every answer in random games with reveals, knowledge lists only cards still in the rival's hand", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 80 }), (choices) => {
        let s = startGame(3, 2, rs, setup);
        checkKnowledge(s);
        for (const pick of choices) {
          if (s.public.status.kind === "over") break;
          const open = s.public.pending;
          const d = open[pick % open.length]!;
          const legal = legalAnswers(rs, s, d.side);
          s = applied(s, { decisionId: d.id, side: d.side, value: legal[pick % legal.length]! }, rs).state;
          checkKnowledge(s);
        }
      }),
    );
  });
});
