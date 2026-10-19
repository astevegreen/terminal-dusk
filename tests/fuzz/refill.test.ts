// The random fuzz games really refill hands (docs/design/core-loop.md, "Refilling hands"), so the card checks
// in checks.ts run on drawn cards and on a draw pile rebuilt from the discards.
import { apply, createGame, seedHash } from "@terminal-dusk/engine";
import type { GameEvent, GameState, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkNoLeaks, reshuffledCards } from "./checks.ts";
import { playFuzzGame, randomGame, ruleset } from "./play.ts";
import { seededRng } from "./random.ts";

const GAMES = 50;

describe("refilling hands in the random games", () => {
  it("draws cards at turn starts and runs the draw pile out in some games", () => {
    let draws = 0;
    let reshuffles = 0;
    for (let game = 1; game <= GAMES; game++) {
      const { record } = playFuzzGame(game);
      const created = createGame(ruleset, record.setup, record.seed);
      if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
      let state = created.value.state;
      for (const answer of record.answers) {
        const next = apply(ruleset, state, answer);
        if (!next.ok) throw new Error(`apply failed: ${next.error.code}`);
        state = next.value.state;
        draws += next.value.events.filter((e) => e.kind === "cardDrawn").length;
        reshuffles += next.value.events.filter((e) => e.kind === "drawPileReshuffled").length;
      }
    }
    expect(draws).toBeGreaterThan(20);
    expect(reshuffles).toBeGreaterThan(0);
  });
  it("gives every game a hand size of at least 1 + plays per turn, and some games a larger one", () => {
    const setups = Array.from({ length: GAMES }, (_, i) => randomGame(seededRng(i + 1), i + 1).setup);
    expect(setups.every((setup) => setup.handSize >= 1 + setup.playsPerTurn)).toBe(true);
    expect(setups.some((setup) => setup.handSize > 1 + setup.playsPerTurn)).toBe(true);
  });
});

const SEED = "refill-seed";
const SETUP: Setup = {
  seedHash: seedHash(SEED),
  hands: { lio: ["c1", "c4"], sae: ["c2", "c5"] },
  deck: ["c3", "c6"],
  turns: 1,
  playsPerTurn: 1,
  handSize: 2,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
};

/**
 * A state as if a refill had just shuffled c7, c8 and c9 from the discard pile into a new draw pile, and
 * LIO then drew c9. Only the parts checkNoLeaks reads are set.
 */
function afterReshuffle(): GameState {
  const r = createGame(ruleset, SETUP, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  const s = r.value.state;
  const lio = { ...s.private.lio, hand: [...s.private.lio.hand, "c9"] };
  return { ...s, private: { ...s.private, lio }, secret: { ...s.secret, deck: ["c7", "c8"] } };
}
const named = (card: string): GameEvent => ({ kind: "marker", visibility: "public", label: card });
const reshuffle: GameEvent = { kind: "drawPileReshuffled", visibility: "public", cards: 3 };
const lioDraws: GameEvent = {
  kind: "cardDrawn",
  visibility: "lio",
  side: "lio",
  card: "c9",
  publicForm: { kind: "cardDrawnHidden", visibility: "public", side: "lio" },
};

describe("invariant 4 with a reshuffle: the cards shuffled back were face up until then", () => {
  it("finds the reshuffled cards: the draw pile now plus the cards drawn after the reshuffle, none without one", () => {
    expect(reshuffledCards(afterReshuffle(), [reshuffle, lioDraws]).sort()).toEqual(["c7", "c8", "c9"]);
    expect(reshuffledCards(afterReshuffle(), [lioDraws])).toEqual([]);
  });
  it("passes events before the reshuffle that name the cards it shuffled, even the one LIO then drew", () => {
    const events = [named("c7"), named("c9"), reshuffle, lioDraws];
    expect(() => checkNoLeaks(afterReshuffle(), events, SEED)).not.toThrow();
  });
  it("fails an event after the reshuffle that names a card now in the draw pile", () => {
    const events = [reshuffle, lioDraws, named("c7")];
    expect(() => checkNoLeaks(afterReshuffle(), events, SEED)).toThrow(/events for 'lio' show card "c7"/);
  });
  it("fails an event after the reshuffle that shows SAE the card LIO drew", () => {
    const events = [reshuffle, lioDraws, named("c9")];
    expect(() => checkNoLeaks(afterReshuffle(), events, SEED)).toThrow(/events for 'sae' show card "c9"/);
  });
  it("passes fuzz games 16 and 955, which failed when a card played in the open was shuffled back in the same step", () => {
    for (const game of [16, 955]) expect(() => playFuzzGame(game)).not.toThrow();
  });
  it("fails an event before the reshuffle that names a card in the rival's hand, which was never shuffled", () => {
    const events = [named("c2"), reshuffle, lioDraws];
    expect(() => checkNoLeaks(afterReshuffle(), events, SEED)).toThrow(/events for 'lio' show card "c2"/);
  });
});
