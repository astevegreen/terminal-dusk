// Property test (#169): in random games where LIO, SAE and neutral cards hold `if playedBy` steps (some
// nested, some in a trigger's reaction, some after a choice), every branch run is "then" exactly when the
// side tested is the side that picked or played that card.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { legalAnswers } from "./index.ts";
import type { CardId, Side, Step } from "./index.ts";
import { applied, choose, forEach, setupPlus, sideCard, startGame, withCards } from "./test/game.ts";

/** Records "card:side:then" or "card:side:else" for each side tested. */
const tests = (card: CardId): Step[] =>
  (["lio", "sae"] as const).map((side) => ({
    op: "if",
    cond: { op: "playedBy", side },
    then: [{ op: "marker", label: `${card}:${side}:then` }],
    else: [{ op: "marker", label: `${card}:${side}:else` }],
  }));
const turnEnd = (steps: Step[]): Step => ({ op: "trigger", hook: "turnEnd", do: steps, duration: { kind: "turnEnd" } });
const cardPlayed = (steps: Step[]): Step => ({
  op: "trigger",
  hook: "cardPlayed",
  do: steps,
  duration: { kind: "turnEnd" },
});

const rs = withCards(
  sideCard("l1", 2, tests("l1")),
  sideCard("l2", 3, [choose("a", "sae"), ...tests("l2")]),
  sideCard("l9", 1, [forEach(["x", "y"], "i", tests("l9"))]),
  sideCard("s1", 1, [turnEnd(tests("s1"))]),
  sideCard("s2", 2, [cardPlayed(tests("s2"))]),
  sideCard("s9", 4, [choose("a", "lio"), ...tests("s9")]),
  sideCard("n1", 2, tests("n1")),
  sideCard("n2", 3, [cardPlayed([turnEnd(tests("n2"))])]),
);
const setup = setupPlus({ lio: ["s9"], sae: ["l9"] }, 2, 2);

describe("playedBy: the branch run always matches who picked or played the card", () => {
  it("every recorded branch is then exactly when the side tested picked or played that card", () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 80 }), (choices) => {
        let s = startGame(2, 2, rs, setup);
        const playedBy = new Map<CardId, Side>();
        for (const pick of choices) {
          if (s.public.status.kind === "over") break;
          const open = s.public.pending;
          const d = open[pick % open.length]!;
          const legal = legalAnswers(rs, s, d.side);
          const value = legal[pick % legal.length]!;
          // The side answering a pick or a play is the one the engine records for that card's event.
          if (value.kind === "chooseCard" || value.kind === "playCardAs") playedBy.set(value.card, d.side);
          const r = applied(s, { decisionId: d.id, side: d.side, value }, rs);
          for (const e of r.events) {
            if (e.kind !== "marker") continue;
            const [card, side, branch] = e.label.split(":") as [CardId, Side, string];
            expect(playedBy.get(card)).toBeDefined();
            expect(branch === "then").toBe(playedBy.get(card) === side);
          }
          s = r.state;
        }
      }),
    );
  });
});
