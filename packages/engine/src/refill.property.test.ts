// Property test for refilling hands (docs/design/core-loop.md, "Refilling hands"): in random games of random
// sizes, with an era entering on turn 2 and the draw pile running out, both hands hold exactly the hand size
// whenever a turn's opening pick opens, and every card is always in exactly one place.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, createGame, legalAnswers, seedHash } from "./index.ts";
import type { CardId, GameState, Ruleset, Setup } from "./index.ts";
import { rulesetWith } from "./test/game.ts";

const ids = (prefix: string, from: number, n: number): CardId[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${from + i}`);

/** A random game: its ruleset, its setup, and the picks that choose each answer. */
const gameArb = fc
  .record({
    turns: fc.integer({ min: 1, max: 5 }),
    playsPerTurn: fc.integer({ min: 1, max: 3 }),
    extraHand: fc.integer({ min: 0, max: 4 }),
    neutralCut: fc.nat(),
    spare: fc.integer({ min: 0, max: 12 }),
    lioShare: fc.nat(),
    eraCards: fc.integer({ min: 0, max: 8 }),
    seed: fc.nat(),
    picks: fc.array(fc.nat(), { maxLength: 200 }),
  })
  .map(({ turns, playsPerTurn, extraHand, neutralCut, spare, lioShare, eraCards, seed, picks }) => {
    const handSize = 1 + playsPerTurn + extraHand;
    // The first era holds at least two hands' worth of cards: the smallest the setup checks allow, plus spare.
    // Any number of them may be neutral, up to all: a hand of only neutral cards can still open (decisions.ts).
    const firstEra = 2 * handSize + spare;
    const neutrals = neutralCut % (firstEra + 1);
    const sideCards = firstEra - neutrals;
    const lio = lioShare % (sideCards + 1);
    const deck = [...ids("l", 1, lio), ...ids("s", 1, sideCards - lio), ...ids("n", 1, neutrals)];
    const era = [...ids("l", 100, Math.ceil(eraCards / 2)), ...ids("s", 100, Math.floor(eraCards / 2))];
    const base = rulesetWith([...deck, ...era]);
    const ruleset: Ruleset = {
      ...base,
      cards: base.cards.map((card) => (era.includes(card.id) ? { ...card, era: "era2" } : card)),
    };
    const s = `refill-${seed}`;
    const setup: Setup = {
      seedHash: seedHash(s),
      hands: { lio: [], sae: [] },
      deck,
      turns,
      playsPerTurn,
      handSize,
      ...(era.length > 0 && turns >= 2 ? { eras: [{ era: "era2", turn: 2, cards: era }] } : {}),
      contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
    };
    return { ruleset, setup, seed: s, picks };
  });

/** Every card in the game, wherever it is: the hands, the draw pile, play, the discards and the eras to come. */
const places = (s: GameState): CardId[] =>
  [
    ...s.private.lio.hand,
    ...s.private.sae.hand,
    ...s.secret.deck,
    ...s.public.inPlay,
    ...s.public.discard,
    ...s.secret.eras.flatMap((entry) => entry.cards),
  ].sort();

/** A turn's opening pick has just opened: both sides' card picks are open and neither has picked. */
const turnStart = (s: GameState): boolean =>
  s.public.pending.length === 2 &&
  s.public.pending.every((d) => d.kind === "chooseCard") &&
  s.private.lio.picks.length === 0 &&
  s.private.sae.picks.length === 0;

describe("refilling hands in random games", () => {
  it("both hands hold the hand size at every opening pick, and every card is always in one place", () => {
    fc.assert(
      fc.property(gameArb, ({ ruleset, setup, seed, picks }) => {
        const created = createGame(ruleset, setup, seed);
        expect(created.ok).toBe(true);
        if (!created.ok) return;
        let s = created.value.state;
        const everyCard = places(s);
        const checkTurnStart = (state: GameState) => {
          if (!turnStart(state)) return;
          expect(state.private.lio.hand).toHaveLength(setup.handSize);
          expect(state.private.sae.hand).toHaveLength(setup.handSize);
        };
        checkTurnStart(s);
        for (const pick of picks) {
          if (s.public.status.kind === "over") break;
          const open = s.public.pending;
          expect(open.length).toBeGreaterThan(0);
          const d = open[pick % open.length]!;
          const legal = legalAnswers(ruleset, s, d.side);
          expect(legal.length).toBeGreaterThan(0);
          const r = apply(ruleset, s, { decisionId: d.id, side: d.side, value: legal[pick % legal.length]! });
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          s = r.value.state;
          expect(places(s)).toEqual(everyCard);
          checkTurnStart(s);
        }
      }),
    );
  });
});
