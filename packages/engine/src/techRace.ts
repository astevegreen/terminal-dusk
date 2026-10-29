// The tech race (docs/design/tech-race.md): one shared public marker, negative for LIO's lead and positive for SAE's,
// on a track of `steps` each way from parity. A card played for its points may spend them all on one attempt a turn
// per side, when they carry the next move's cost: the side draws from its own Contingency deck, and a draw (plus any
// first-there bonus) of `success` or more moves the marker one step its way. Reaching a step first earns +1 on the
// side's next attempt; entering the Escalation step on a side's own attempt raises Escalation by 1. Quantum
// Computing's era score and the tie-break are in scoring.ts. The track's numbers are scenario data (MapTechRace).
import { drawContingency } from "./contingency.ts";
import { raiseEscalation } from "./escalation.ts";
import { SIDES } from "./types.ts";
import type { GameEvent, GameMap, GameState, MapTechRace, PublicState, Side, TechRaceState } from "./types.ts";

/** The way `side` moves the marker: towards its own end. */
const way = (side: Side): number => (side === "lio" ? -1 : 1);

/**
 * The steps whose powers are fixed by number from parity (docs/design/tech-race.md, "What each step gives"): +1 in
 * the holder's realignments, and +1 to its interventions. Hypersonics' extra play is the track's `escalateAt` step,
 * and Quantum Computing's powers are its last step.
 */
export const NETWORKS = 1;
export const AI_STEP = 2;

/**
 * Whether `side` holds tech race step `step` (1 = the first from parity): the side the marker favours holds its step
 * and every step below it, so its powers add up; the other side holds none. False in a game without a tech race.
 */
export const techHolds = (pub: PublicState, side: Side, step: number): boolean =>
  pub.techRace !== undefined && pub.techRace.marker * way(side) >= step;

/**
 * What `side`'s next move of the marker costs, or null when it has none: moving towards its own end costs the step
 * moved onto; pulling the rival back costs the step left. A side at its own end has no move.
 */
export function techRaceCost(pub: PublicState, side: Side): number | null {
  const steps = pub.map?.techRace?.steps;
  if (steps === undefined || pub.techRace === undefined) return null;
  const { marker } = pub.techRace;
  const level = Math.abs(marker);
  if (marker * way(side) < 0) return steps[level - 1]!.cost;
  return level < steps.length ? steps[level]!.cost : null;
}

/** Whether `side` may spend `points` from a card played for its points on a tech race attempt now. */
export function canRace(pub: PublicState, side: Side, points: number): boolean {
  if (pub.techRace === undefined || pub.turnEndFired || pub.techRace.attempted.includes(side)) return false;
  const cost = techRaceCost(pub, side);
  return cost !== null && points >= cost;
}

/**
 * The side to offer Hypersonics' extra play now, or null: the side holding the track's `escalateAt` step, with a
 * card in its hand, not yet offered it this turn (docs/design/tech-race.md, "The extra play").
 */
export function extraPlayer(state: GameState): Side | null {
  const pub = state.public;
  const step = pub.map?.techRace?.escalateAt;
  if (step === undefined || pub.techRace === undefined || pub.techRace.extraPlay !== undefined) return null;
  return SIDES.find((side) => techHolds(pub, side, step) && state.private[side].hand.length > 0) ?? null;
}

/** The side holding Quantum Computing, the track's last step, or null (docs/design/tech-race.md, "The opening-card power"). */
export function quantumHolder(pub: PublicState): Side | null {
  const step = pub.map?.techRace?.steps.length;
  return step === undefined ? null : (SIDES.find((side) => techHolds(pub, side, step)) ?? null);
}

/** `list` with `item` added once, in `order`. */
const added = <T>(list: readonly T[], item: T, order: readonly T[]): T[] =>
  order.filter((x) => x === item || list.includes(x));

/**
 * `side`'s tech race attempt with `points` (canRace has said it may): uses up its bonus, draws from its own deck,
 * moves the marker one step its way on a success, records a step reached first and its bonus, and raises Escalation
 * on entering the Escalation step moving away from parity. One techRaceAttempted event. Edits `state` in place.
 */
export function attemptTechRace(state: GameState, side: Side, points: number, events: GameEvent[]): void {
  const pub = state.public;
  const track = pub.map!.techRace!;
  const race = pub.techRace!;
  const cost = techRaceCost(pub, side)!;
  const bonus = race.bonus.includes(side) ? 1 : 0;
  race.bonus = race.bonus.filter((s) => s !== side);
  race.attempted = added(race.attempted, side, SIDES);
  const draw = drawContingency(state, side, events);
  const from = race.marker;
  const to = draw + bonus >= track.success ? from + way(side) : from;
  const away = Math.abs(to) > Math.abs(from);
  const first = away && !race.reached.includes(Math.abs(to));
  race.marker = to;
  if (first) {
    race.reached = [...race.reached, Math.abs(to)].sort((a, b) => a - b);
    race.bonus = added(race.bonus, side, SIDES);
  }
  events.push({ kind: "techRaceAttempted", visibility: "public", side, points, cost, draw, bonus, from, to, first });
  if (away && Math.abs(to) === track.escalateAt) raiseEscalation(state, 1, side, events);
}

/** The tech race a game with `map` starts with: at parity, when the map has one; otherwise nothing. */
export function techRaceState(map: GameMap): { techRace?: TechRaceState } {
  return map.techRace === undefined ? {} : { techRace: { marker: 0, attempted: [], reached: [], bonus: [] } };
}

/** A fresh copy of a checked track. */
export const copyTechRace = ({ steps, success, escalateAt }: MapTechRace): MapTechRace => ({
  steps: steps.map(({ name, cost }) => ({ name, cost })),
  success,
  escalateAt,
});

const isWhole = (v: unknown, min: number): boolean => Number.isInteger(v) && (v as number) >= min;

/** Why one step is unusable, or null: a name and a whole cost, 1 or more. */
function stepError(step: unknown, at: number): string | null {
  if (typeof step !== "object" || step === null) return `Tech race step ${at + 1} must be an object.`;
  const { name, cost } = step as Record<string, unknown>;
  if (typeof name !== "string" || name.length === 0) return `Tech race step ${at + 1} needs a name.`;
  return isWhole(cost, 1) ? null : `Tech race step ${name}'s cost must be a whole number, 1 or more.`;
}

/**
 * Why the map's tech race is unusable, or null. A map without one is fine. At least one step; whole `success`, 1 or
 * more; `escalateAt` a step of the track. Never throws on bad input.
 */
export function techRaceError(map: GameMap): string | null {
  const race: unknown = map.techRace;
  if (race === undefined) return null;
  if (typeof race !== "object" || race === null) return "The map's tech race must be an object.";
  const { steps, success, escalateAt } = race as Record<string, unknown>;
  if (!Array.isArray(steps) || steps.length === 0) return "The tech race needs a list of at least one step.";
  for (const [at, step] of (steps as unknown[]).entries()) {
    const error = stepError(step, at);
    if (error !== null) return error;
  }
  if (!isWhole(success, 1)) return "The tech race's success number must be a whole number, 1 or more.";
  if (!isWhole(escalateAt, 1) || (escalateAt as number) > steps.length) {
    return `The tech race's escalateAt must be a step of the track, 1 to ${steps.length}.`;
  }
  return null;
}
