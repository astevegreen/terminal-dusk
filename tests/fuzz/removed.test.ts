// The fuzz suite and R8a's once-only cards (#205): some fuzz cards are flagged removeAfterEvent, the card count
// includes the removed pile, the removed pile and the turn-start refill are checked against the state before each
// step, and the fuzz games reach every way a flagged card can leave play.
import { apply, createGame, seedHash } from "@terminal-dusk/engine";
import type { Answer, CardDef, GameState, Setup } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkCards } from "./checks.ts";
import { FUZZ_CARDS, playFuzzGame, randomGame, ruleset } from "./play.ts";
import { seededRng } from "./random.ts";
import { flaggedLeft, handSizeFor, LEAVING, noteUse } from "./removed.ts";
import type { Left, Use } from "./removed.ts";
import { checkRefilled, checkRemoved } from "./removedChecks.ts";

const SEED = "removed-seed";
// c4 is LIO's and c11 SAE's, both flagged; c1, c2, c3 and c5 to c9 stay in the game.
const SETUP: Setup = {
  seedHash: seedHash(SEED),
  hands: { lio: ["c1", "c4"], sae: ["c2", "c11"] },
  deck: ["c3", "c5", "c6", "c7", "c8", "c9"],
  turns: 2,
  playsPerTurn: 1,
  handSize: 2,
  contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6], world: [1, 2, 3, 4, 5, 6] },
};

function started(): GameState {
  const r = createGame(ruleset, SETUP, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}
/** `state` with its public part changed by `pub`. */
const withPublic = (state: GameState, pub: Partial<GameState["public"]>): GameState => ({
  ...state,
  public: { ...state.public, ...pub },
});
const plays = (side: "lio" | "sae", card: string, as: "event" | "points"): Answer => ({
  decisionId: "d9",
  side,
  value: { kind: "playCardAs", card, as },
});

describe("the fuzz cards flagged removeAfterEvent", () => {
  const flagged = ruleset.cards.filter((card) => card.flags?.removeAfterEvent === true);
  it("include at least one LIO, one SAE and one neutral card", () => {
    const affiliations = new Set<CardDef["affiliation"]>(flagged.map((card) => card.affiliation));
    expect(affiliations).toEqual(new Set(["lio", "sae", "neutral"]));
  });
  it("keep every card's id and affiliation", () => {
    expect(ruleset.cards.map((card) => card.id)).toEqual(FUZZ_CARDS);
    expect(ruleset.cards.map((card) => card.affiliation)).toEqual(
      FUZZ_CARDS.map((_, i) => ["lio", "sae", "neutral"][i % 3]),
    );
  });
  it("leave every random setup accepted by createGame's hand-size check", () => {
    for (let game = 1; game <= 2000; game++) {
      const { setup, seed } = randomGame(seededRng(game), game);
      const r = createGame(ruleset, setup, seed);
      expect(r.ok ? null : `${game}: ${r.error.message}`).toBeNull();
    }
  });
  it("lower the hand size when a hand is dealt more than it, so the other hand can still refill", () => {
    const lio = ["c1", "c2", "c3", "c5", "c6", "c7", "c8", "c9"];
    const era = { lio, sae: ["c10", "c12"], deck: ["c13", "c14"], turns: 1, playsPerTurn: 1 };
    // 12 cards stay in the game; LIO keeps its 8 on turn 1, so SAE can only count on 4.
    expect(handSizeFor(6, era)).toBe(4);
    expect(handSizeFor(6, { ...era, lio: lio.slice(0, 2), deck: [...lio.slice(2), "c13", "c14"] })).toBe(6);
    // Over two turns, the flagged c4 in the draw pile may have left the game before turn 2.
    expect(handSizeFor(6, { ...era, lio: lio.slice(0, 6), deck: ["c4", "c13", "c14", "c15", "c16"], turns: 2 })).toBe(
      6,
    );
    expect(handSizeFor(6, { ...era, lio: lio.slice(0, 6), deck: ["c4", "c13", "c14", "c15"], turns: 2 })).toBe(5);
  });
  it("passes fuzz game 6944, where SAE's hand came up short once LIO had been dealt 12 cards", () => {
    expect(() => playFuzzGame(6944)).not.toThrow();
  });
});

describe("checkCards counts the removed pile", () => {
  it("passes a state with a flagged card moved from the hand to the removed pile", () => {
    const s = started();
    const lio = { ...s.private.lio, hand: s.private.lio.hand.filter((card) => card !== "c4") };
    expect(() =>
      checkCards(SETUP, { ...withPublic(s, { removed: ["c4"] }), private: { ...s.private, lio } }),
    ).not.toThrow();
  });
  it("fails a state with a card both in the removed pile and in the discard pile", () => {
    const s = started();
    const lio = { ...s.private.lio, hand: s.private.lio.hand.filter((card) => card !== "c4") };
    const both = { ...withPublic(s, { removed: ["c4"], discard: ["c4"] }), private: { ...s.private, lio } };
    expect(() => checkCards(SETUP, both)).toThrow(/extra or twice \["c4"\]/);
  });
  it("fails a state with a card missing from every pile", () => {
    const s = started();
    const lio = { ...s.private.lio, hand: s.private.lio.hand.filter((card) => card !== "c4") };
    expect(() => checkCards(SETUP, { ...s, private: { ...s.private, lio } })).toThrow(/missing \["c4"\]/);
  });
});

describe("checkRemoved compares the removed pile with the state before the step", () => {
  const s = started();
  it("passes a flagged own card removed after this step's answer played it for its event", () => {
    expect(() =>
      checkRemoved(ruleset, s, plays("lio", "c4", "event"), withPublic(s, { removed: ["c4"] })),
    ).not.toThrow();
  });
  it("passes a flagged rival's card removed after a play for its points, recorded with its player in inPlayBy", () => {
    const prior = withPublic(s, { inPlay: ["c11"], inPlayBy: ["lio"], removed: ["c4"] });
    const answer: Answer = { decisionId: "d9", side: "lio", value: { kind: "rivalEventOrder", event: "before" } };
    expect(() => checkRemoved(ruleset, prior, answer, withPublic(s, { removed: ["c4", "c11"] }))).not.toThrow();
    expect(() =>
      checkRemoved(ruleset, s, plays("lio", "c11", "points"), withPublic(s, { removed: ["c11"] })),
    ).not.toThrow();
  });
  it("fails a card dropped from the removed pile, or the pile's order changed", () => {
    const prior = withPublic(s, { removed: ["c4", "c11"] });
    expect(() => checkRemoved(ruleset, prior, plays("lio", "c1", "event"), withPublic(s, { removed: ["c4"] }))).toThrow(
      /does not start with/,
    );
    expect(() =>
      checkRemoved(ruleset, prior, plays("lio", "c1", "event"), withPublic(s, { removed: ["c11", "c4"] })),
    ).toThrow(/does not start with/);
  });
  it("fails an unflagged card in the removed pile", () => {
    expect(() => checkRemoved(ruleset, s, plays("lio", "c1", "event"), withPublic(s, { removed: ["c1"] }))).toThrow(
      /c1 is in the removed pile, but is not flagged/,
    );
  });
  it("fails a flagged own card removed after a play for its points", () => {
    expect(() => checkRemoved(ruleset, s, plays("lio", "c4", "points"), withPublic(s, { removed: ["c4"] }))).toThrow(
      /c4 left the game in this step, but its event did not run/,
    );
  });
  it("fails a flagged card removed while inPlayBy recorded a play for points only", () => {
    const prior = withPublic(s, { inPlay: ["c4"], inPlayBy: [null] });
    expect(() => checkRemoved(ruleset, prior, plays("sae", "c2", "event"), withPublic(s, { removed: ["c4"] }))).toThrow(
      /its event did not run/,
    );
  });
});

describe("checkRefilled: after the turn number goes up, both hands hold the hand size", () => {
  const s = started();
  it("passes a new turn whose hands are full", () => {
    expect(() => checkRefilled(SETUP, withPublic(s, { turn: 0 }), s)).not.toThrow();
  });
  it("fails a new turn that opens with a short hand", () => {
    const sae = { ...s.private.sae, hand: s.private.sae.hand.slice(1) };
    expect(() => checkRefilled(SETUP, withPublic(s, { turn: 0 }), { ...s, private: { ...s.private, sae } })).toThrow(
      /sae holding 1 cards, not the hand size 2/,
    );
  });
  it("does not check a step in the same turn, when hands shrink during play", () => {
    const sae = { ...s.private.sae, hand: [] };
    expect(() => checkRefilled(SETUP, s, { ...s, private: { ...s.private, sae } })).not.toThrow();
  });
});

/** The fixed number of random games the counts below are taken over. */
const GAMES = 200;
type Counts = Record<
  "ownEvent" | "neutralEvent" | "opening" | "pointsDiscarded" | "rivalPoints" | "wrong" | "reshuffle",
  number
>;

/** Which count a flagged card that left play adds to; "wrong" when its event ran but it was discarded. */
function kindOf({ card, to, use }: Left): keyof Counts {
  const affiliation = ruleset.cards.find((c) => c.id === card)!.affiliation;
  const own = affiliation === use.side || affiliation === "neutral";
  if (use.how === "points" && own) return to === "discard" ? "pointsDiscarded" : "wrong";
  if (to === "discard") return "wrong";
  if (use.how === "opening") return "opening";
  if (use.how === "points") return "rivalPoints";
  return affiliation === "neutral" ? "neutralEvent" : affiliation === use.side ? "ownEvent" : "wrong";
}

describe("the fuzz games move flagged cards out of play every way", () => {
  it("count each way a flagged card leaves play, and a reshuffle once cards have left the game", () => {
    const counts: Counts = {
      ownEvent: 0,
      neutralEvent: 0,
      opening: 0,
      pointsDiscarded: 0,
      rivalPoints: 0,
      wrong: 0,
      reshuffle: 0,
    };
    for (let game = 1; game <= GAMES; game++) {
      const { record } = playFuzzGame(game);
      const created = createGame(ruleset, record.setup, record.seed);
      if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
      let state = created.value.state;
      const uses = new Map<string, Use>();
      for (const answer of record.answers) {
        noteUse(uses, answer);
        const next = apply(ruleset, state, answer);
        if (!next.ok) throw new Error(`apply failed: ${next.error.code}`);
        for (const left of flaggedLeft(LEAVING, uses, state, answer, next.value.state)) counts[kindOf(left)] += 1;
        const reshuffled = next.value.events.some((e) => e.kind === "drawPileReshuffled");
        if (reshuffled && state.public.removed.length > 0) counts.reshuffle += 1;
        state = next.value.state;
      }
    }
    expect(counts.ownEvent).toBeGreaterThan(0);
    expect(counts.neutralEvent).toBeGreaterThan(0);
    expect(counts.opening).toBeGreaterThan(0);
    expect(counts.pointsDiscarded).toBeGreaterThan(0);
    expect(counts.rivalPoints).toBeGreaterThan(0);
    expect(counts.reshuffle).toBeGreaterThan(0);
    expect(counts.wrong).toBe(0);
  });
});
