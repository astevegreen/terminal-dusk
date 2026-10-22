// Tests for the fuzz harness's Contingency deck checks (#64): the deck invariant and the structural leak
// check each catch a hand-corrupted state, and the random games use varied decks. The random games draw
// and reshuffle (#65, harness.test.ts), but never break these checks; the corrupted states below prove
// each part works.
import { apply, createGame, seedHash, viewFor } from "@terminal-dusk/engine";
import type { DeckId, GameEvent, GameState, PlayerView, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkContingency, checkNoLeaks, contingencyLeaksIn, isSubMultiset } from "./checks.ts";
import { byCodeUnit } from "./order.ts";
import { playFuzzGame, randomGame, ruleset } from "./play.ts";
import { seededRng } from "./random.ts";

const SEED = "contingency-seed";
/**
 * One turn of one play each. LIO's Contingency deck is 1 to 6; SAE's is [6, 2, 4, 2], so it reads [2, 2, 4, 6];
 * the World deck is [9, 3, 3], so it reads [3, 3, 9].
 */
const SETUP: Setup = {
  seedHash: seedHash(SEED),
  hands: { lio: ["c1", "c4"], sae: ["c2", "c5"] },
  deck: ["c6", "c7", "c8"],
  turns: 1,
  playsPerTurn: 1,
  handSize: 2,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [6, 2, 4, 2], world: [9, 3, 3] },
};

function started(): GameState {
  const r = createGame(ruleset, SETUP, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

/** `state` with one Contingency deck's public lists and secret order replaced, where given. */
function withDeck(
  state: GameState,
  side: DeckId,
  change: { cards?: number[]; left?: number[]; order?: number[] },
): GameState {
  const open = state.public.contingency[side];
  const deck = { cards: change.cards ?? open.cards, left: change.left ?? open.left };
  const order = change.order ?? state.secret.contingency[side];
  return {
    ...state,
    public: { ...state.public, contingency: { ...state.public.contingency, [side]: deck } },
    secret: { ...state.secret, contingency: { ...state.secret.contingency, [side]: order } },
  };
}

describe("the Contingency decks: full contents, numbers left and the secret order agree", () => {
  it("passes a fresh game", () => {
    expect(() => checkContingency(SETUP, started())).not.toThrow();
  });

  it("fails full contents that are not the setup's deck", () => {
    const s = withDeck(started(), "lio", { cards: [1, 2, 3, 4, 5, 7] });
    expect(() => checkContingency(SETUP, s)).toThrow(/lio's Contingency deck: the full contents .* not the setup's/);
  });

  it("fails full contents in the setup's order instead of sorted", () => {
    const s = withDeck(started(), "sae", { cards: [6, 2, 4, 2] });
    expect(() => checkContingency(SETUP, s)).toThrow(/sae's Contingency deck: the full contents/);
  });

  it("fails numbers left that are not the secret order, sorted: a wrong number, or the list in draw order", () => {
    const wrong = withDeck(started(), "lio", { left: [1, 2, 3, 4, 5, 5] });
    expect(() => checkContingency(SETUP, wrong)).toThrow(/lio's Contingency deck: the numbers left .* secret order/);
    const inDrawOrder = withDeck(started(), "lio", { order: [6, 5, 4, 3, 2, 1], left: [6, 5, 4, 3, 2, 1] });
    expect(() => checkContingency(SETUP, inDrawOrder)).toThrow(/not the secret order, sorted/);
  });

  it("fails numbers left that are not all in the full contents, counting repeats", () => {
    expect(isSubMultiset([2, 2, 4], [2, 2, 4, 6])).toBe(true);
    expect(isSubMultiset([2, 2, 2], [2, 2, 4, 6])).toBe(false);
    const s = withDeck(started(), "sae", { left: [2, 2, 2], order: [2, 2, 2] });
    expect(() => checkContingency(SETUP, s)).toThrow(
      /sae's Contingency deck: the numbers left \[2,2,2\] are not all in/,
    );
  });

  it("checks the World deck too: its full contents, and numbers left that agree with its secret order", () => {
    const contents = withDeck(started(), "world", { cards: [3, 9, 9] });
    expect(() => checkContingency(SETUP, contents)).toThrow(/the World deck: the full contents .* not the setup's/);
    const left = withDeck(started(), "world", { left: [3, 9] });
    expect(() => checkContingency(SETUP, left)).toThrow(/the World deck: the numbers left .* secret order/);
  });

  it("fails a deck holding 1 card, or none", () => {
    const one = withDeck(started(), "lio", { left: [3], order: [3] });
    expect(() => checkContingency(SETUP, one)).toThrow(/lio's Contingency deck holds 1 cards/);
    const none = withDeck(started(), "sae", { left: [], order: [] });
    expect(() => checkContingency(SETUP, none)).toThrow(/sae's Contingency deck holds 0 cards/);
  });
});

describe("invariant 4 for the Contingency decks: no view or event shows the order", () => {
  it("passes a game whose secret order happens to be sorted, so it reads like the public numbers left", () => {
    const s = withDeck(started(), "lio", { order: [1, 2, 3, 4, 5, 6] });
    expect(() => checkNoLeaks(s, [], SEED)).not.toThrow();
  });

  it("fails a public deck with a field beyond cards and left", () => {
    const s = started();
    const lio = { ...s.public.contingency.lio, order: s.secret.contingency.lio };
    const leaky = { ...s, public: { ...s.public, contingency: { ...s.public.contingency, lio } } };
    expect(() => checkNoLeaks(leaky, [], SEED)).toThrow(
      /view for 'lio' shows lio's Contingency deck with the fields cards, left, order/,
    );
  });

  it("fails a view whose count left is not the secret order's", () => {
    const s = started();
    const view = viewFor(s, "sae");
    const sae = { cards: [2, 2, 4, 6], left: [2, 4] };
    const short = { ...view, public: { ...view.public, contingency: { ...view.public.contingency, sae } } };
    expect(contingencyLeaksIn(short, s)).toEqual([
      "sae's Contingency deck with a count left that is not the secret order's",
    ]);
  });

  it("fails a view whose World deck count left is not the secret order's, or has an extra field", () => {
    const s = started();
    const view = viewFor(s, "lio");
    const world = { cards: [3, 3, 9], left: [3] };
    const short = { ...view, public: { ...view.public, contingency: { ...view.public.contingency, world } } };
    expect(contingencyLeaksIn(short, s)).toEqual(["the World deck with a count left that is not the secret order's"]);
    const leaky = { ...view.public.contingency.world, order: s.secret.contingency.world };
    const extra = { ...view, public: { ...view.public, contingency: { ...view.public.contingency, world: leaky } } };
    expect(contingencyLeaksIn(extra, s)).toEqual(["the World deck with the fields cards, left, order"]);
  });

  it("fails a view with a contingency field anywhere else", () => {
    const s = started();
    const view = viewFor(s, "lio");
    const extra = { ...view, counts: { ...view.counts, contingency: s.secret.contingency } } as PlayerView;
    expect(contingencyLeaksIn(extra, s)).toEqual(["the field view.counts.contingency"]);
    const inState = { ...s, public: { ...s.public, contingencyOrder: s.secret.contingency.lio } } as GameState;
    expect(() => checkNoLeaks(inState, [], SEED)).toThrow(
      /view for 'lio' shows the field view\.public\.contingencyOrder/,
    );
  });

  it("fails an event that carries a contingency field", () => {
    const events = [
      { kind: "marker", visibility: "public", label: "x", contingency: [3, 1] },
    ] as unknown as GameEvent[];
    expect(() => checkNoLeaks(started(), events, SEED)).toThrow(
      /events for 'lio' show the field events\.0\.contingency/,
    );
  });
});

describe("the random games' Contingency decks", () => {
  // Moved here from harness.test.ts when the World deck joined it (#131), to keep that file under 350 lines.
  it("the random games draw contingencies and reshuffle a deck, for each side and the World deck, so the deck checks run on real draws", () => {
    const seen = new Set<string>();
    for (let game = 1; game <= 20; game++) {
      const { record } = playFuzzGame(game);
      const first = createGame(ruleset, record.setup, record.seed);
      if (!first.ok) throw new Error(`createGame failed: ${first.error.code}`);
      let state = first.value.state;
      for (const answer of record.answers) {
        const next = apply(ruleset, state, answer);
        if (!next.ok) throw new Error(`apply failed: ${next.error.code}`);
        state = next.value.state;
        for (const e of next.value.events) {
          if (e.kind === "contingencyDrawn" || e.kind === "contingencyDeckReshuffled") seen.add(`${e.kind} ${e.deck}`);
        }
      }
    }
    expect([...seen].sort(byCodeUnit)).toEqual([
      "contingencyDeckReshuffled lio",
      "contingencyDeckReshuffled sae",
      "contingencyDeckReshuffled world",
      "contingencyDrawn lio",
      "contingencyDrawn sae",
      "contingencyDrawn world",
    ]);
  });

  it("lengths vary, and repeats, two-digit numbers and the default 1 to 6 all turn up", () => {
    const setups = Array.from({ length: 200 }, (_, i) => randomGame(seededRng(i + 1), i + 1).setup);
    const decks = setups.flatMap((setup) => [setup.contingency.lio, setup.contingency.sae, setup.contingency.world]);
    const worlds = setups.map((setup) => setup.contingency.world);
    expect(new Set(worlds.map((d) => d.join())).size).toBeGreaterThan(3);
    expect(new Set(decks.map((d) => d.length)).size).toBeGreaterThan(3);
    expect(decks.some((d) => new Set(d).size < d.length)).toBe(true);
    expect(decks.some((d) => d.some((n) => n >= 10))).toBe(true);
    expect(decks.some((d) => [...d].sort((a, b) => a - b).join() === "1,2,3,4,5,6")).toBe(true);
    for (const d of decks) {
      expect(d.length).toBeGreaterThanOrEqual(2);
      expect(d.every((n) => Number.isInteger(n) && n >= 1)).toBe(true);
    }
  });
});
