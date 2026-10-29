// Era-end region scoring (docs/design/map-and-points.md, "Scoring"). At the end of each era's last turn every region
// scores in the map's scoring order, with the ending era's battlegrounds. Each side scores its highest level there
// (present, ahead or holding every battleground) plus 1 for each battleground it controls, and the shared score track
// moves once per region, by the difference. A side that reaches its end of the track wins at once; after the final
// era, the side the track leans towards wins. The amounts and the track's size are scenario data (MapScoring).
import { isBattleground } from "./battlegrounds.ts";
import { controller } from "./influence.ts";
import { otherSide, SIDES } from "./types.ts";
import type { GameEvent, GameMap, GameState, PublicState, RegionAmounts, Side } from "./types.ts";

/** What each controlled battleground in a scoring region adds, beyond its level (owner: "yes, +1 each"). */
export const BATTLEGROUND_POINT = 1;

/** One region's points for each side. */
export type RegionPoints = Record<Side, number>;

/** The highest level a side reaches in a region: nothing, present, ahead or holding every battleground ("all"). */
export type RegionLevel = "none" | "present" | "ahead" | "all";

/** Each side's level in one region and the points it would score there now. */
export type RegionStanding = Record<Side, { level: RegionLevel; points: number }>;

/**
 * Each side's level in the region of `amounts` as the public state is now, with the current era's battlegrounds, and
 * the points that gives: the level's amount plus 1 for each battleground it controls. "Holds every battleground"
 * needs at least one; in a region with none, ahead is on countries only. A pure helper on public data, so the app
 * can show a region's standing before it scores (docs/architecture.md, Decision 6).
 */
export function regionStanding(pub: PublicState, amounts: RegionAmounts): RegionStanding {
  const ids = (pub.map?.countries ?? []).filter((c) => c.region === amounts.region).map((c) => c.id);
  const battlegrounds = ids.filter((id) => isBattleground(pub, id));
  const held = (side: Side, list: string[]): number => list.filter((id) => controller(pub, id) === side).length;
  const level = (side: Side, bgs: number): RegionLevel => {
    const rival = otherSide(side);
    if (battlegrounds.length > 0 && bgs === battlegrounds.length) return "all";
    const moreBgs = battlegrounds.length === 0 || bgs > held(rival, battlegrounds);
    if (held(side, ids) > held(rival, ids) && moreBgs) return "ahead";
    return held(side, ids) > 0 ? "present" : "none";
  };
  const standing = (side: Side): { level: RegionLevel; points: number } => {
    const bgs = held(side, battlegrounds);
    const reached = level(side, bgs);
    return { level: reached, points: reached === "none" ? 0 : amounts[reached] + BATTLEGROUND_POINT * bgs };
  };
  return { lio: standing("lio"), sae: standing("sae") };
}

/** What the region of `amounts` scores for each side as the public state is now: regionStanding's points. */
export function regionScore(pub: PublicState, amounts: RegionAmounts): RegionPoints {
  const { lio, sae } = regionStanding(pub, amounts);
  return { lio: lio.points, sae: sae.points };
}

/** The side whose end the track is at, or null. */
function atEnd(score: number, end: number): Side | null {
  if (score <= -end) return "lio";
  return score >= end ? "sae" : null;
}

/** Whether the turn ending now is the last of its era: the game's last turn, or one before a waiting era enters. */
export function eraEnds(state: GameState): boolean {
  const { turn, turns } = state.public;
  return turn >= turns || state.secret.eras.some((entry) => entry.turn === turn + 1);
}

/**
 * Moves the score track by `delta` (towards SAE when positive), stopping at its ends, with a scoreChanged event when
 * it moves. Reaching a side's end wins the game for that side at once (reason "trackEnd"): nothing is left pending,
 * no program runs on and no simultaneous pick waits. Returns true when the game ended. Does nothing on a map without
 * scoring. Edits `state`, apply's working copy, in place.
 */
export function moveScore(state: GameState, delta: number, events: GameEvent[]): boolean {
  const pub = state.public;
  const scoring = pub.map?.scoring;
  if (scoring === undefined || pub.score === undefined) return false;
  const { end } = scoring.track;
  const from = pub.score;
  const to = Math.max(-end, Math.min(end, from + delta));
  if (to === from) return false;
  pub.score = to;
  events.push({ kind: "scoreChanged", visibility: "public", from, to });
  const winner = atEnd(to, end);
  if (winner === null) return false;
  pub.pending = [];
  pub.stack.length = 0; // In place: runStack's loop holds this same array, so it stops after the current step.
  for (const side of SIDES) state.private[side].picks = [];
  pub.status = { kind: "over", winner, reason: "trackEnd" };
  return true;
}

/**
 * Scores every region in order and moves the track, if the map has scoring and the turn ending now is its era's last.
 * A track end ends the game at once (moveScore) and the regions after it don't score. Edits `state`, apply's working
 * copy, in place.
 */
export function scoreEra(state: GameState, events: GameEvent[]): void {
  const pub = state.public;
  if (pub.map?.scoring === undefined || pub.score === undefined || !eraEnds(state)) return;
  for (const amounts of pub.map.scoring.regions) {
    const points = regionScore(pub, amounts);
    events.push({ kind: "regionScored", visibility: "public", region: amounts.region, ...points });
    if (moveScore(state, points.sae - points.lio, events)) return;
  }
  quantumScore(state, events);
}

/**
 * Quantum Computing's era score (docs/design/tech-race.md): after every region, a tech race marker at a side's end
 * of its track moves the score track 1 towards that side, which may end the game there.
 */
function quantumScore(state: GameState, events: GameEvent[]): void {
  const pub = state.public;
  const end = pub.map?.techRace?.steps.length;
  if (pub.techRace === undefined || end === undefined || Math.abs(pub.techRace.marker) !== end) return;
  moveScore(state, Math.sign(pub.techRace.marker), events);
}

/**
 * The winner after the final era: the side the track leans towards. An even track goes to the side the tech race
 * marker favours (docs/design/tech-race.md); null when that is at parity too, or there is no track or tech race.
 */
export function leader(pub: PublicState): Side | null {
  if (pub.score === undefined) return null;
  const lean = pub.score === 0 ? (pub.techRace?.marker ?? 0) : pub.score;
  if (lean === 0) return null;
  return lean < 0 ? "lio" : "sae";
}

/** The score track a game with `map` starts with: `{ score }` when the map has scoring, otherwise nothing. */
export function scoreState(map: GameMap): { score?: number } {
  return map.scoring === undefined ? {} : { score: map.scoring.track.start };
}

const isWhole = (v: unknown, min: number): boolean => Number.isInteger(v) && (v as number) >= min;

/** Why the score track is unusable, or null: its end is a whole number of 1 or more, its start strictly inside. */
function trackError(track: unknown): string | null {
  if (typeof track !== "object" || track === null) return "The map's scoring needs a track { end, start }.";
  const { end, start } = track as Record<string, unknown>;
  if (!isWhole(end, 1)) return "The score track's end must be a whole number, 1 or more.";
  if (!Number.isInteger(start) || Math.abs(start as number) >= (end as number)) {
    return `The score track's start must be a whole number strictly between -${String(end)} and ${String(end)}.`;
  }
  return null;
}

/** Why one scoring region is unusable, or null: a known region not `seen` before, with whole amounts of 0 or more. */
function regionError(entry: unknown, known: ReadonlySet<string>, seen: ReadonlySet<unknown>): string | null {
  if (typeof entry !== "object" || entry === null) return "Each scoring region must be an object.";
  const { region, ...amounts } = entry as Record<string, unknown>;
  if (!known.has(region as string)) return `The map's scoring names unknown region ${String(region)}.`;
  if (seen.has(region)) return `The map's scoring names region ${String(region)} twice.`;
  const level = (["present", "ahead", "all"] as const).find((l) => !isWhole(amounts[l], 0));
  return level === undefined ? null : `Region ${String(region)}'s ${level} amount must be a whole number, 0 or more.`;
}

/**
 * Why the map's scoring is unusable, or null. A map without scoring is fine. Run after the map's shape and ids are
 * checked. Never throws on bad input.
 */
export function scoringError(map: GameMap): string | null {
  const scoring: unknown = map.scoring;
  if (scoring === undefined) return null;
  if (typeof scoring !== "object" || scoring === null) return "The map's scoring must be an object.";
  const { track, regions } = scoring as Record<string, unknown>;
  const bad = trackError(track);
  if (bad !== null) return bad;
  if (!Array.isArray(regions)) return "The map's scoring regions must be a list.";
  const known = new Set(map.regions.map((r) => r.id));
  const seen = new Set<unknown>();
  for (const entry of regions as unknown[]) {
    const error = regionError(entry, known, seen);
    if (error !== null) return error;
    seen.add((entry as Record<string, unknown>).region);
  }
  const missing = map.regions.find((r) => !seen.has(r.id));
  return missing === undefined ? null : `The map's scoring does not name region ${missing.id}.`;
}
