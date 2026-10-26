// Refilling hands (docs/design/core-loop.md, "Refilling hands"): at each turn's start both sides draw up to
// the hand size from one shared draw pile, after a new era enters and before the opening picks; an empty
// draw pile is rebuilt from the shuffled discards; the setup checks make running out of both impossible.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { createGame } from "./createGame.ts";
import { legalAnswers } from "./decisions.ts";
import { eventsFor } from "./events.ts";
import { seedRng, shuffle } from "./rng.ts";
import { seedHash } from "./sha256.ts";
import { rulesetWith } from "./test/game.ts";
import { byCodeUnit } from "./test/sort.ts";
import type { CardId, EraEntry, GameEvent, GameState, Setup } from "./types.ts";

const ids = (prefix: string, n: number): CardId[] => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
/** LIO's l1-l6, SAE's s1-s6 and neutral n1-n2. */
const PILE = [...ids("l", 6), ...ids("s", 6), ...ids("n", 2)];
/** era2's cards: e1-e4, neutral. */
const ERA = ids("e", 4);
const rs = (() => {
  const base = rulesetWith([...PILE, ...ERA]);
  return { ...base, cards: base.cards.map((c) => (ERA.includes(c.id) ? { ...c, era: "era2" } : c)) };
})();

/** No dealt hands: the draw pile is PILE, the hand size 3, 2 turns of 1 play each. */
const setup = (over: Partial<Setup> = {}): Setup => ({
  seedHash: seedHash("seed-1"),
  hands: { lio: [], sae: [] },
  deck: [...PILE],
  turns: 2,
  playsPerTurn: 1,
  handSize: 3,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
  ...over,
});

function start(s: Setup): { state: GameState; events: GameEvent[] } {
  const r = createGame(rs, s, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code} ${r.error.message ?? ""}`);
  return r.value;
}

const codeFor = (s: Setup): string => {
  const r = createGame(rs, s, "seed-1");
  return r.ok ? "ok" : r.error.code;
};

/**
 * Gives each open decision its first legal answer until turn 2 starts. Returns the state just before the
 * answer that starts it, and that answer's state and events.
 */
function intoTurn2(s: Setup) {
  let before = start(s).state;
  for (;;) {
    const d = before.public.pending[0];
    if (!d) throw new Error("no decision pending");
    const r = apply(rs, before, { decisionId: d.id, side: d.side, value: legalAnswers(rs, before, d.side)[0]! });
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    if (r.value.state.public.turn === 2) return { before, after: r.value.state, events: r.value.events };
    before = r.value.state;
  }
}

describe("the first hand: the turn 1 refill deals it", () => {
  it("deals each side the hand size from the top of the shuffled draw pile, LIO's cards first, then SAE's", () => {
    const { state } = start(setup());
    const pile = shuffle(seedRng("seed-1"), PILE).items;
    expect(state.private.lio.hand).toEqual(pile.slice(0, 3));
    expect(state.private.sae.hand).toEqual(pile.slice(3, 6));
    expect(state.secret.deck).toEqual(pile.slice(6));
  });

  it("refills before the opening picks: the turn opens on the card pick with both hands full", () => {
    const { state } = start(setup());
    expect(state.public.pending.map((d) => d.kind)).toEqual(["chooseCard", "chooseCard"]);
    expect(state.public.handSize).toBe(3);
  });

  it("tells each side which cards it drew, and everyone else only that a card was drawn", () => {
    const { state, events } = start(setup());
    const lioSees = eventsFor(events, "lio");
    const lioDrew = lioSees.flatMap((e) => (e.kind === "cardDrawn" ? [e.card] : []));
    expect(lioDrew).toEqual(state.private.lio.hand);
    expect(lioSees.filter((e) => e.kind === "cardDrawnHidden")).toEqual(
      Array(3).fill({ kind: "cardDrawnHidden", visibility: "public", side: "sae" }),
    );
    const watcherText = JSON.stringify(eventsFor(events, "spectator"));
    expect(eventsFor(events, "spectator").filter((e) => e.kind === "cardDrawnHidden")).toHaveLength(6);
    for (const card of [...state.private.lio.hand, ...state.private.sae.hand]) {
      expect(watcherText).not.toContain(JSON.stringify(card));
    }
  });
});

describe("later refills", () => {
  it("keeps the cards still in hand and draws only up to the hand size", () => {
    const { before, after } = intoTurn2(setup());
    const kept = before.private.lio.hand;
    expect(kept.length).toBeLessThan(3);
    expect(after.private.lio.hand).toEqual([...kept, ...before.secret.deck.slice(0, 3 - kept.length)]);
    expect(after.private.sae.hand).toHaveLength(3);
  });

  it("draws a new era's cards on the turn it enters: the era is shuffled in before the refill", () => {
    // The pile holds exactly the six first hands, so turn 2's refill can only draw the era's four cards.
    const era: EraEntry = { era: "era2", turn: 2, cards: [...ERA] };
    const { after, events } = intoTurn2(setup({ deck: PILE.slice(0, 6), eras: [era] }));
    const drawn = [...after.private.lio.hand, ...after.private.sae.hand].filter((c) => ERA.includes(c));
    expect(drawn.toSorted(byCodeUnit)).toEqual(ERA.toSorted(byCodeUnit));
    expect(after.public.discard).toHaveLength(4);
    const kinds = events.map((e) => e.kind);
    expect(kinds.indexOf("eraStarted")).toBeLessThan(kinds.indexOf("cardDrawn"));
    expect(kinds).not.toContain("drawPileReshuffled");
  });

  it("a dealt hand larger than the hand size is kept, and draws nothing until it drops below", () => {
    const { state } = start(setup({ hands: { lio: PILE.slice(0, 4), sae: [] }, deck: PILE.slice(4) }));
    expect(state.private.lio.hand).toEqual(PILE.slice(0, 4));
    expect(state.private.sae.hand).toHaveLength(3);
  });

  it("a dealt hand smaller than the hand size keeps its cards and is topped up", () => {
    const { state } = start(setup({ hands: { lio: ["l1", "l2"], sae: [] }, deck: PILE.slice(2) }));
    expect(state.private.lio.hand.slice(0, 2)).toEqual(["l1", "l2"]);
    expect(state.private.lio.hand).toHaveLength(3);
  });
});

describe("when the draw pile runs out", () => {
  // Exactly the six first hands in the pile: turn 2's refill finds it empty and must use the discards.
  const tight = setup({ deck: PILE.slice(0, 6) });

  it("shuffles the discard pile into a new draw pile and goes on drawing from it", () => {
    const { before, after } = intoTurn2(tight);
    expect(before.secret.deck).toEqual([]);
    expect(after.private.lio.hand).toHaveLength(3);
    expect(after.private.sae.hand).toHaveLength(3);
    expect(after.public.discard).toEqual([]);
    expect(after.secret.deck).toEqual([]);
    expect([...after.private.lio.hand, ...after.private.sae.hand].toSorted(byCodeUnit)).toEqual(
      PILE.slice(0, 6).toSorted(byCodeUnit),
    );
  });

  it("tells everyone the discards were reshuffled and how many cards that made, never which", () => {
    const { events } = intoTurn2(tight);
    expect(events.filter((e) => e.kind === "drawPileReshuffled")).toEqual([
      { kind: "drawPileReshuffled", visibility: "public", cards: 4 },
    ]);
  });

  it("the same seed gives the same new draw pile", () => {
    expect(intoTurn2(tight).after.private).toEqual(intoTurn2(tight).after.private);
  });
});

describe("a refilled hand of only neutral cards", () => {
  // A hand size of 2, and SAE is dealt its own s1-s3: turn 1's refill can only give LIO the pile's neutral n1-n2.
  const allNeutral = setup({ handSize: 2, hands: { lio: [], sae: ["s1", "s2", "s3"] }, deck: ["n1", "n2"] });

  it("can still open the turn: every neutral card in the hand is a legal opening pick", () => {
    const { state } = start(allNeutral);
    expect(state.private.lio.hand.toSorted(byCodeUnit)).toEqual(["n1", "n2"]);
    expect(rs.cards.filter((c) => state.private.lio.hand.includes(c.id)).map((c) => c.affiliation)).toEqual(
      Array(2).fill("neutral"),
    );
    const lioPick = state.public.pending.find((d) => d.side === "lio");
    expect(lioPick?.kind).toBe("chooseCard");
    expect(legalAnswers(rs, state, "lio")).toEqual(
      state.private.lio.hand.map((card) => ({ kind: "chooseCard", card })),
    );
  });

  it("plays on: both turns are played to the end of the game", () => {
    let s = start(allNeutral).state;
    for (let answers = 0; s.public.status.kind !== "over"; answers++) {
      if (answers > 100) throw new Error("the game did not end");
      const d = s.public.pending[0];
      if (!d) throw new Error("no decision pending");
      const legal = legalAnswers(rs, s, d.side);
      expect(legal.length).toBeGreaterThan(0);
      const r = apply(rs, s, { decisionId: d.id, side: d.side, value: legal[0]! });
      if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
      s = r.value.state;
    }
    expect(s.public.turn).toBe(2);
  });
});

describe("createGame checks the hand size", () => {
  it("accepts a hand size of 1 + plays per turn with twice that many first-era cards", () => {
    expect(codeFor(setup({ handSize: 2, deck: PILE.slice(0, 4) }))).toBe("ok");
  });
  it("rejects a hand size that is missing or not a whole number", () => {
    expect(codeFor(setup({ handSize: 2.5 }))).toBe("invalidSetup");
    expect(codeFor({ ...setup(), handSize: undefined as unknown as number })).toBe("invalidSetup");
  });
  it("rejects a hand size smaller than 1 + plays per turn: a side could not make all its plays", () => {
    expect(codeFor(setup({ handSize: 2, playsPerTurn: 2 }))).toBe("invalidSetup");
  });
  it("rejects a first era with fewer cards than twice the hand size: both hands could not fill", () => {
    expect(codeFor(setup({ deck: PILE.slice(0, 5) }))).toBe("invalidSetup");
  });
  it("counts dealt hands as part of the first era", () => {
    expect(codeFor(setup({ hands: { lio: ["l1"], sae: [] }, deck: PILE.slice(1, 6) }))).toBe("ok");
  });
  it("does not count a later era's cards toward the first era's", () => {
    const era: EraEntry = { era: "era2", turn: 2, cards: [...ERA] };
    expect(codeFor(setup({ deck: PILE.slice(0, 5), eras: [era] }))).toBe("invalidSetup");
  });
});

describe("createGame counts only the first era's cards that stay in the game", () => {
  /** rs with the cards `ids` flagged removeAfterEvent. */
  const flagging = (ids: readonly CardId[]) => ({
    ...rs,
    cards: rs.cards.map((c) => (ids.includes(c.id) ? { ...c, flags: { removeAfterEvent: true as const } } : c)),
  });

  it("refuses a setup that passes with no flagged cards once enough of its first-era cards are flagged", () => {
    const six = setup({ deck: PILE.slice(0, 6) });
    expect(codeFor(six)).toBe("ok");
    const r = createGame(flagging(["l1"]), six, "seed-1");
    expect(r.ok ? "ok" : r.error).toEqual({
      code: "invalidSetup",
      message: "The first era has 5 cards that stay in the game; two hands of 3 need at least 6.",
    });
  });

  it("accepts a setup exactly at the limit: twice the hand size in cards that stay, plus flagged ones", () => {
    const r = createGame(flagging(["l1", "s1"]), setup({ deck: PILE.slice(0, 8) }), "seed-1");
    expect(r.ok).toBe(true);
  });

  it("counts flagged cards in dealt hands as leaving too", () => {
    const dealt = setup({ hands: { lio: ["l1"], sae: [] }, deck: PILE.slice(1, 6) });
    expect(codeFor(dealt)).toBe("ok");
    const r = createGame(flagging(["l1"]), dealt, "seed-1");
    expect(r.ok ? "ok" : r.error.code).toBe("invalidSetup");
  });
});
