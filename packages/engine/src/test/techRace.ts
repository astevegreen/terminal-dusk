// Test helpers for the tech race (R25; docs/design/tech-race.md): the test map with the doc's track, a ruleset with
// cards worth enough points, and games at LIO's first play with the marker and Contingency draws set as a test needs.
import type { Answer, AnswerValue, GameState, MapTechRace, Ruleset, Setup, Side, TechRaceState } from "../types.ts";
import { marker, playAnswers, sideCard, startGame, withCards } from "./game.ts";
import { mapSetup, testMap } from "./map.ts";

/** The doc's track: four steps each way costing 1 to 4, a draw of 4 or more to move, Escalation at Hypersonics. */
export const TECH_RACE: MapTechRace = {
  steps: [
    { name: "Networks and Orbit", cost: 1 },
    { name: "AI", cost: 2 },
    { name: "Hypersonics", cost: 3 },
    { name: "Quantum Computing", cost: 4 },
  ],
  success: 4,
  escalateAt: 3,
};

/**
 * The test ruleset with l2 and s2 worth 4 points, l3 and s3 worth 2, and s9, SAE's 4-point once-only card whose event
 * sets the marker "s9-event". LIO also holds s9, so it can play the rival's card.
 */
export const raceRules: Ruleset = withCards(
  sideCard("l2", 4),
  sideCard("l3", 2),
  sideCard("s2", 4),
  sideCard("s3", 2),
  { ...sideCard("s9", 4, [marker("s9-event")]), flags: { removeAfterEvent: true } },
);

/** The test map with the tech race, `turns` turns of `playsPerTurn` plays, LIO holding s9 too. */
export function raceSetup(turns = 2, playsPerTurn = 1, race: MapTechRace = TECH_RACE): Setup {
  const base = mapSetup({ ...testMap(), techRace: race }, turns, playsPerTurn);
  return { ...base, hands: { lio: [...base.hands.lio, "s9"], sae: base.hands.sae } };
}

/** `state` with the tech race changed by `race`. */
export const withRace = (state: GameState, race: Partial<TechRaceState>): GameState => ({
  ...state,
  public: { ...state.public, techRace: { ...state.public.techRace!, ...race } },
});

/** A tech race game at LIO's first play (both opening picks made), with the tech race changed by `race`. */
export function raceGame(race: Partial<TechRaceState> = {}, turns = 2, playsPerTurn = 1): GameState {
  return withRace(
    playAnswers(startGame(turns, playsPerTurn, raceRules, raceSetup(turns, playsPerTurn)), 2, raceRules),
    race,
  );
}

/** `state` with `side`'s next Contingency draw set to `value` (the deck keeps the same cards). */
export function nextDraw(state: GameState, side: Side, value: number): GameState {
  const order = state.secret.contingency[side];
  const at = order.indexOf(value);
  if (at < 0) throw new Error(`${side}'s deck has no ${value} left`);
  const reordered = [value, ...order.slice(0, at), ...order.slice(at + 1)];
  return { ...state, secret: { ...state.secret, contingency: { ...state.secret.contingency, [side]: reordered } } };
}

/** The answer `value` to the action choice `state` has open. */
export function choose(state: GameState, value: AnswerValue): Answer {
  const d = state.public.pending[0];
  if (d?.kind !== "chooseAction") throw new Error(`no action choice pending: ${JSON.stringify(state.public.pending)}`);
  return { decisionId: d.id, side: d.side, value };
}

export const techRaceAction: AnswerValue = { kind: "chooseAction", action: "techRace" };
export const placeAction: AnswerValue = { kind: "chooseAction", action: "place" };

/** The actions on the menu `state` has open, or null when no action choice is open. */
export function menu(state: GameState): string[] | null {
  const d = state.public.pending[0];
  return d?.kind === "chooseAction" && "actions" in d.options ? d.options.actions : null;
}
