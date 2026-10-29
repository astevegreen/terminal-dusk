// R25 (#462): what the tech race does beyond moving its marker (docs/design/tech-race.md, "What each step gives" and
// "Links to the rest of the game"): entering Hypersonics on a side's own attempt raises Escalation by 1, a crisis it
// causes is that side's; at each era's end, after the regions, Quantum Computing moves the score track 1 its way;
// and an even score track at the end goes to the side the marker favours.
import { describe, expect, it } from "vitest";
import type { GameEvent, GameState, MapScoring, PublicState, Side } from "./index.ts";
import { leader } from "./scoring.ts";
import { applied, orderAnswer, playAnswer, playAnswers, startGame } from "./test/game.ts";
import { testMap } from "./test/map.ts";
import {
  choose,
  nextDraw,
  raceGame,
  raceRules,
  raceSetup,
  TECH_RACE,
  techRaceAction,
  withRace,
} from "./test/techRace.ts";

/** `side` plays `card` for its points and makes a tech race attempt, its draw being `draw`. */
function attempt(state: GameState, side: Side, card: string, draw: number) {
  const played = applied(nextDraw(state, side, draw), playAnswer(state, side, card, "points"), raceRules).state;
  return applied(played, choose(played, techRaceAction), raceRules);
}

const escalations = (events: readonly GameEvent[]) =>
  events.filter((e) => e.kind === "escalationChanged" || e.kind === "escalationCrisis");

describe("entering Hypersonics", () => {
  it("raises Escalation by 1 when a side's own attempt moves the marker from AI to Hypersonics", () => {
    const { state, events } = attempt(raceGame({ marker: -2, reached: [1, 2] }), "lio", "l2", 4);
    expect(state.public.techRace!.marker).toBe(-3);
    expect(escalations(events)).toEqual([{ kind: "escalationChanged", visibility: "public", from: 2, to: 3 }]);
  });

  it("raises nothing when the rival pulls the marker back from Quantum Computing to Hypersonics", () => {
    const { state, events } = attempt(raceGame({ marker: 4, reached: [1, 2, 3, 4] }), "lio", "l2", 4);
    expect(state.public.techRace!.marker).toBe(3);
    expect(escalations(events)).toEqual([]);
  });

  it("raises nothing on a failed attempt", () => {
    const { events } = attempt(raceGame({ marker: -2, reached: [1, 2] }), "lio", "l2", 3);
    expect(escalations(events)).toEqual([]);
  });

  it("a crisis it causes is the advancing side's, even with the rival's card", () => {
    const start = raceGame({ marker: -2, reached: [1, 2] });
    const at5 = { ...start, public: { ...start.public, escalation: 5 } };
    const played = applied(at5, playAnswer(at5, "lio", "s9", "points"), raceRules).state;
    const ordered = applied(nextDraw(played, "lio", 4), orderAnswer(played, "lio", "after"), raceRules).state;
    const { events } = applied(ordered, choose(ordered, techRaceAction), raceRules);
    expect(events).toContainEqual(expect.objectContaining({ kind: "escalationCrisis", side: "lio" }));
  });
});

/** Made-up scoring: the track's ends at -`end` and `end`; only east scores, 1 for being present. */
const scoring = (end: number): MapScoring => ({
  track: { end, start: 0 },
  regions: [
    { region: "north", present: 0, ahead: 0, all: 0 },
    { region: "south", present: 0, ahead: 0, all: 0 },
    { region: "east", present: 1, ahead: 1, all: 1 },
  ],
});

/** A one-turn tech race game with scoring, no influence but `foxtrot`'s, and the marker at `marker`, at its last play. */
function lastPlay(marker: number, end = 5, foxtrot: { lio: number; sae: number } = { lio: 0, sae: 0 }): GameState {
  const setup = raceSetup(1, 1);
  const map = { ...testMap(), techRace: TECH_RACE, scoring: scoring(end), startingInfluence: [] };
  const state = playAnswers(startGame(1, 1, raceRules, { ...setup, map }), 3, raceRules);
  const influence = state.public.influence!.map((e) =>
    e.country === "foxtrot" ? { country: e.country, ...foxtrot } : e,
  );
  return withRace({ ...state, public: { ...state.public, influence } }, { marker });
}

/**
 * `state` after its last normal play, and Hypersonics' extra play passed when it is offered (R26b): a side holding
 * Quantum Computing holds Hypersonics too.
 */
function finish(state: GameState): GameState {
  const played = playAnswers(state, 1, raceRules);
  const d = played.public.pending[0];
  if (d?.kind !== "extraPlay") return played;
  return applied(played, { decisionId: d.id, side: d.side, value: { kind: "pass" } }, raceRules).state;
}

describe("Quantum Computing's era score", () => {
  it("after the regions score, moves the score track 1 toward the side holding it", () => {
    const end = finish(lastPlay(-4));
    expect(end.public.score).toBe(-1);
    expect(end.public.status).toEqual({ kind: "over", winner: "lio", reason: "turnLimitReached" });
    expect(finish(lastPlay(4)).public.score).toBe(1);
  });

  it("does nothing for a side one step short of Quantum Computing", () => {
    expect(finish(lastPlay(-3)).public.score).toBe(0);
  });

  it("wins at once when it reaches the holder's end of the track", () => {
    const end = finish(lastPlay(-4, 1));
    expect(end.public.status).toEqual({ kind: "over", winner: "lio", reason: "trackEnd" });
  });

  it("comes after every region: a region that ends the game leaves it unscored", () => {
    // SAE is present in east and reaches its end (+1) first; LIO's Quantum Computing never moves the track.
    const end = finish(lastPlay(-4, 1, { lio: 0, sae: 1 }));
    expect(end.public.score).toBe(1);
    expect(end.public.status).toEqual({ kind: "over", winner: "sae", reason: "trackEnd" });
  });
});

describe("the tie-break on an even score track", () => {
  const pub = (score: number, marker?: number): PublicState =>
    ({
      score,
      ...(marker === undefined ? {} : { techRace: { marker, attempted: [], reached: [], bonus: [] } }),
    }) as unknown as PublicState;

  it("goes to the side the marker favours", () => {
    expect(leader(pub(0, -1))).toBe("lio");
    expect(leader(pub(0, 2))).toBe("sae");
  });

  it("is a draw with the marker at parity, or with no tech race", () => {
    expect(leader(pub(0, 0))).toBeNull();
    expect(leader(pub(0))).toBeNull();
  });

  it("never overrides a score track that leans one way", () => {
    expect(leader(pub(-1, 4))).toBe("lio");
  });

  it("decides a finished game whose track ends even", () => {
    const end = finish(lastPlay(2));
    expect(end.public.score).toBe(0);
    expect(end.public.status).toEqual({ kind: "over", winner: "sae", reason: "turnLimitReached" });
  });
});
