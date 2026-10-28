// R21: era-end region scoring (docs/design/map-and-points.md, "Scoring"). At the end of each era's last turn every
// region scores in the scenario's order and moves the shared score track once, by the difference. A side that reaches
// its end of the track wins at once, so later regions don't score; after the final era, the side the track leans
// towards wins.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import { createGame } from "./createGame.ts";
import { legalAnswers } from "./decisions.ts";
import { seedHash } from "./sha256.ts";
import { viewFor } from "./views.ts";
import { playAnswers, ruleset, rulesetWith } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";
import type { CountryId, GameEvent, GameState, MapScoring, ScoreEvent, Setup, SetupMap } from "./types.ts";

/** The test ruleset plus e1, a card of era-2. */
const base = rulesetWith([...ruleset.cards.map((card) => card.id), "e1"]);
const rs = { ...base, cards: base.cards.map((card) => (card.id === "e1" ? { ...card, era: "era-2" } : card)) };

/**
 * Made-up scoring: the track runs from LIO's end at -10 to SAE's end at 10 and starts at 0; regions score in the
 * list's order, south, east, then north. Era-1's battlegrounds are charlie (north) and delta (south); era-2's only one
 * is foxtrot (east).
 */
const SCORING: MapScoring = {
  track: { end: 10, start: 0 },
  regions: [
    { region: "south", present: 1, ahead: 2, all: 4 },
    { region: "east", present: 2, ahead: 3, all: 6 },
    { region: "north", present: 1, ahead: 3, all: 5 },
  ],
};
const scoringMap = (scoring: MapScoring = SCORING): SetupMap => ({
  ...testMap(),
  battlegrounds: [
    { era: "era-1", countries: ["charlie", "delta"] },
    { era: "era-2", countries: ["foxtrot"] },
  ],
  startingInfluence: [],
  scoring,
});
/** Three turns, era-1 for turn 1 and era-2 from turn 2: era-1 ends after turn 1, era-2 after turn 3. */
const setupOf = (map: SetupMap = scoringMap()): Setup => ({
  ...mapSetup(map, 3),
  eras: [{ era: "era-2", turn: 2, cards: ["e1"] }],
});

function start(setup: Setup = setupOf()): GameState {
  const r = createGame(rs, { ...setup, seedHash: seedHash("seed-1") }, "seed-1");
  if (!r.ok) throw new Error(`createGame failed: ${r.error.message}`);
  return r.value.state;
}

type Counts = Record<CountryId, { lio?: number; sae?: number }>;
/** `state` with influence from `counts` (0 where none is given) and the track at `score`, if given. */
function withBoard(state: GameState, counts: Counts, score?: number): GameState {
  const influence = state.public.influence!.map(({ country }) => ({
    country,
    lio: counts[country]?.lio ?? 0,
    sae: counts[country]?.sae ?? 0,
  }));
  return { ...state, public: { ...state.public, influence, ...(score === undefined ? {} : { score }) } };
}

/** Answers the first open decision with its first legal answer. The test cards do nothing, so influence stays put. */
function step(state: GameState): { state: GameState; events: GameEvent[] } {
  const d = state.public.pending[0]!;
  const r = apply(rs, state, { decisionId: d.id, side: d.side, value: legalAnswers(rs, state, d.side)[0]! });
  if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
  return r.value;
}
/** A turn takes 4 answers: two opening picks and one play each. The 4th ends the turn. */
const ANSWERS_PER_TURN = 4;
/** The state just before the answer that ends turn `turn`. */
const beforeEndOf = (turn: number, state = start()): GameState => playAnswers(state, ANSWERS_PER_TURN * turn - 1, rs);

/** The scoring events, in order. */
const scoreEvents = (events: readonly GameEvent[]): ScoreEvent[] =>
  events.filter((e): e is ScoreEvent => e.kind === "regionScored" || e.kind === "scoreChanged");
const scored = (region: string, lio: number, sae: number): ScoreEvent => ({
  kind: "regionScored",
  visibility: "public",
  region,
  lio,
  sae,
});
const moved = (from: number, to: number): ScoreEvent => ({ kind: "scoreChanged", visibility: "public", from, to });

describe("the score track", () => {
  it("starts at the scenario's start in a game with scoring, and every viewer sees it", () => {
    const state = start(setupOf(scoringMap({ ...SCORING, track: { end: 10, start: -3 } })));
    expect(state.public.score).toBe(-3);
    for (const viewer of ["lio", "sae", "spectator"] as const) expect(viewFor(state, viewer).public.score).toBe(-3);
  });
  it("is absent in a game whose map has no scoring, and such a game never scores", () => {
    const plain = scoringMap();
    delete plain.scoring;
    let state = start(setupOf(plain));
    expect("score" in state.public).toBe(false);
    const events: GameEvent[] = [];
    while (state.public.status.kind === "active") {
      const r = step(state);
      state = r.state;
      events.push(...r.events);
    }
    expect(scoreEvents(events)).toEqual([]);
    expect(state.public.status).toEqual({ kind: "over", winner: null, reason: "turnLimitReached" });
  });
});

describe("scoring at the end of an era's last turn", () => {
  it("every region scores once, in the scenario's order, with the ending era's battlegrounds", () => {
    // Era-1: LIO holds delta (south's only battleground); SAE controls foxtrot (east, no battleground in era-1).
    const before = withBoard(beforeEndOf(1), { delta: { lio: 2 }, foxtrot: { sae: 1 } });
    const { state, events } = step(before);
    expect(scoreEvents(events)).toEqual([
      scored("south", 4 + 1, 0),
      moved(0, -5),
      scored("east", 0, 3),
      moved(-5, -2),
      scored("north", 0, 0),
    ]);
    expect(state.public.score).toBe(-2);
    expect(state.public.turn).toBe(2);
    expect(state.public.era).toBe("era-2");
  });

  it("scores before the next era's list takes over", () => {
    // Foxtrot is a battleground only in era-2: at era-1's end, SAE's foxtrot earns no battleground point.
    const { events } = step(withBoard(beforeEndOf(1), { foxtrot: { sae: 1 } }));
    expect(scoreEvents(events)).toContainEqual(scored("east", 0, 3));
  });

  it("does not score at the end of a turn that is not an era's last", () => {
    const state = playAnswers(start(), ANSWERS_PER_TURN, rs);
    const { events } = step(withBoard(beforeEndOf(1, state), {}));
    // beforeEndOf(1, state) is mid turn 2, era-2's first turn of two.
    expect(state.public.turn).toBe(2);
    expect(scoreEvents(events)).toEqual([]);
  });

  it("moves the track by the difference only, once per region", () => {
    // South: LIO present (echo, 1), SAE holds every battleground (delta, 4 + 1): SAE by 4.
    const { events } = step(withBoard(beforeEndOf(1), { echo: { lio: 1 }, delta: { sae: 2 } }));
    expect(scoreEvents(events).slice(0, 2)).toEqual([scored("south", 1, 5), moved(0, 4)]);
  });
});

describe("winning on the track", () => {
  it("a side that reaches its end wins at once, and the regions after it don't score", () => {
    // From -6, south moves LIO by 5: the track stops at -10, LIO's end, and east and north never score.
    const before = withBoard(beforeEndOf(1), { delta: { lio: 2 }, foxtrot: { sae: 1 } }, -6);
    const { state, events } = step(before);
    expect(scoreEvents(events)).toEqual([scored("south", 5, 0), moved(-6, -10)]);
    expect(state.public.score).toBe(-10);
    expect(state.public.status).toEqual({ kind: "over", winner: "lio", reason: "trackEnd" });
    expect(state.public.pending).toEqual([]);
    expect(state.public.turn).toBe(1);
  });

  it("SAE wins by reaching its end", () => {
    const { state } = step(withBoard(beforeEndOf(1), { delta: { sae: 2 } }, 8));
    expect(state.public.score).toBe(10);
    expect(state.public.status).toEqual({ kind: "over", winner: "sae", reason: "trackEnd" });
  });

  it("after the final era scores, the side the track leans towards wins", () => {
    // Era-2's end (turn 3): LIO controls foxtrot, era-2's only battleground: east scores 6 + 1 for LIO.
    const state = playAnswers(start(), ANSWERS_PER_TURN * 2, rs);
    const { state: after, events } = step(withBoard(beforeEndOf(1, state), { foxtrot: { lio: 1 } }, 2));
    expect(scoreEvents(events)).toEqual([
      scored("south", 0, 0),
      scored("east", 6 + 1, 0),
      moved(2, -5),
      scored("north", 0, 0),
    ]);
    expect(after.public.score).toBe(-5);
    expect(after.public.status).toEqual({ kind: "over", winner: "lio", reason: "turnLimitReached" });
  });

  it("an even track after the final era has no winner (the tie-break is not built yet)", () => {
    const state = playAnswers(start(), ANSWERS_PER_TURN * 2, rs);
    const { state: after } = step(withBoard(beforeEndOf(1, state), {}, 0));
    expect(after.public.score).toBe(0);
    expect(after.public.status).toEqual({ kind: "over", winner: null, reason: "turnLimitReached" });
  });
});
