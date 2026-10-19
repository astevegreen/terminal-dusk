// Tests for the fuzz harness's era checks (#37): invariant 3 catches a card out of place, waiting era
// cards count as hidden, and the random games really change era.
import { createGame, seedHash } from "@terminal-dusk/engine";
import type { GameState, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkCards, checkNoLeaks, enteredCards, hiddenFrom } from "./checks.ts";
import { playFuzzGame, randomGame, ruleset } from "./play.ts";
import { seededRng } from "./random.ts";

const SEED = "eras-seed";
/** Two turns of one play each: LIO holds c1, c4, c7, c10; SAE c2, c5, c8, c11; the fuzz era brings c3 and c6. */
const SETUP: Setup = {
  seedHash: seedHash(SEED),
  hands: { lio: ["c1", "c4", "c7", "c10"], sae: ["c2", "c5", "c8", "c11"] },
  deck: ["c12", "c13", "c14"],
  turns: 2,
  playsPerTurn: 1,
  handSize: 2,
  eras: [{ era: "fuzz", turn: 2, cards: ["c3", "c6"] }],
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
};

function started(setup: Setup = SETUP): GameState {
  const r = createGame(ruleset, setup, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

/** `state` with its draw pile replaced by `deck`. */
const withDeck = (state: GameState, deck: string[]): GameState => ({ ...state, secret: { ...state.secret, deck } });

describe("invariant 3: every card that has entered the game is in exactly one place", () => {
  it("counts an era's cards as entered only from its turn", () => {
    expect(enteredCards(SETUP, 1)).not.toContain("c3");
    expect(enteredCards(SETUP, 2)).toEqual(expect.arrayContaining(["c3", "c6"]));
  });

  it("passes a fresh game, whose era cards are still waiting", () => {
    expect(() => checkCards(SETUP, started())).not.toThrow();
  });

  it("fails when a card has gone missing", () => {
    const s = started();
    const [first, ...rest] = s.secret.deck;
    expect(() => checkCards(SETUP, withDeck(s, rest))).toThrow(`missing ["${first}"]`);
  });

  it("fails when one card is missing and another is there twice, though the count is right", () => {
    const s = started();
    const [first, ...rest] = s.secret.deck;
    expect(() => checkCards(SETUP, withDeck(s, [...rest, rest[0]!]))).toThrow(
      `missing ["${first}"], extra or twice ["${rest[0]}"]`,
    );
  });

  it("fails when an era's card is in the draw pile before its turn", () => {
    const s = started();
    expect(() => checkCards(SETUP, withDeck(s, [...s.secret.deck, "c3"]))).toThrow('extra or twice ["c3"]');
  });

  it("fails when an era's turn has come and its cards are not in the game", () => {
    const s = started();
    const turn2 = { ...s, public: { ...s.public, turn: 2 } };
    expect(() => checkCards(SETUP, turn2)).toThrow('missing ["c3","c6"]');
  });
});

describe("invariant 4 with eras: cards still waiting are hidden from everyone", () => {
  it("counts the waiting era cards as hidden from both sides and a spectator", () => {
    const s = started();
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(hiddenFrom(s, viewer)).toEqual(expect.arrayContaining(["c3", "c6"]));
    }
  });

  it("fails a view that shows a waiting era card", () => {
    const s = started();
    const leaky = { ...s, public: { ...s.public, discard: ["c3"] } };
    expect(() => checkNoLeaks(leaky, [], SEED)).toThrow(/view for 'lio' shows card "c3"/);
  });
});

describe("random games with eras", () => {
  it("many random games have eras, on turns 2 to the last, none on the same turn and none empty", () => {
    const setups = Array.from({ length: 200 }, (_, i) => randomGame(seededRng(i + 1), i + 1).setup);
    const withEras = setups.filter((setup) => (setup.eras ?? []).length > 0);
    expect(withEras.length).toBeGreaterThan(50);
    expect(withEras.some((setup) => setup.eras!.length >= 2)).toBe(true);
    for (const setup of withEras) {
      const turns = setup.eras!.map((entry) => entry.turn);
      expect(new Set(turns).size).toBe(turns.length);
      expect(turns.every((turn) => turn >= 2 && turn <= setup.turns)).toBe(true);
      expect(setup.eras!.every((entry) => entry.cards.length > 0)).toBe(true);
    }
  });

  it("the random games play through their era changes: every era's cards enter the game, and refills draw some", () => {
    let changed = 0;
    let drawn = 0;
    for (let game = 1; game <= 50; game++) {
      const { record, final } = playFuzzGame(game);
      const eras = record.setup.eras ?? [];
      if (eras.length === 0) continue;
      changed++;
      expect(final.secret.eras).toEqual([]);
      const hands = [...final.private.lio.hand, ...final.private.sae.hand];
      const inGame = [...final.secret.deck, ...hands, ...final.public.discard, ...final.public.inPlay];
      const eraCards = eras.flatMap((entry) => entry.cards);
      expect(inGame).toEqual(expect.arrayContaining(eraCards));
      drawn += eraCards.filter((card) => !final.secret.deck.includes(card)).length;
    }
    expect(changed).toBeGreaterThan(10);
    expect(drawn).toBeGreaterThan(0);
  });
});
