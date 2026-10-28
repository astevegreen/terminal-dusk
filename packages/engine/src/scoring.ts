// Era-end region scoring (docs/design/map-and-points.md, "Scoring"). At the end of each era's last turn every region
// scores in the map's scoring order, with the ending era's battlegrounds. Each side scores its highest level there
// (present, ahead or holding every battleground) plus 1 for each battleground it controls, and the shared score track
// moves once per region, by the difference. A side that reaches its end of the track wins at once; after the final
// era, the side the track leans towards wins. The amounts and the track's size are scenario data (MapScoring).
import { isBattleground } from "./battlegrounds.ts";
import { controller } from "./influence.ts";
import { otherSide } from "./types.ts";
import type { GameEvent, GameMap, GameState, PublicState, RegionAmounts, Side } from "./types.ts";

/** What each controlled battleground in a scoring region adds, beyond its level (owner: "yes, +1 each"). */
export const BATTLEGROUND_POINT = 1;

/** One region's points for each side. */
export type RegionPoints = Record<Side, number>;

/**
 * What the region of `amounts` scores for each side as the public state is now, with the current era's
 * battlegrounds. "Holds every battleground" needs at least one; in a region with none, ahead is on countries only.
 */
export function regionScore(pub: PublicState, amounts: RegionAmounts): RegionPoints {
  const ids = (pub.map?.countries ?? []).filter((c) => c.region === amounts.region).map((c) => c.id);
  const battlegrounds = ids.filter((id) => isBattleground(pub, id));
  const held = (side: Side, list: string[]): number => list.filter((id) => controller(pub, id) === side).length;
  const points = (side: Side): number => {
    const countries = held(side, ids);
    const bgs = held(side, battlegrounds);
    const rival = otherSide(side);
    const bonus = BATTLEGROUND_POINT * bgs;
    if (battlegrounds.length > 0 && bgs === battlegrounds.length) return amounts.all + bonus;
    const moreBgs = battlegrounds.length === 0 || bgs > held(rival, battlegrounds);
    if (countries > held(rival, ids) && moreBgs) return amounts.ahead + bonus;
    return countries > 0 ? amounts.present + bonus : 0;
  };
  return { lio: points("lio"), sae: points("sae") };
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
 * Scores every region in order and moves the track, if the map has scoring and the turn ending now is its era's last.
 * A track end ends the game at once (no pending decisions, reason "trackEnd") and the regions after it don't score.
 * Edits `state`, apply's working copy, in place.
 */
export function scoreEra(state: GameState, events: GameEvent[]): void {
  const pub = state.public;
  const scoring = pub.map?.scoring;
  if (scoring === undefined || pub.score === undefined || !eraEnds(state)) return;
  const { end } = scoring.track;
  let from = pub.score;
  for (const amounts of scoring.regions) {
    const points = regionScore(pub, amounts);
    events.push({ kind: "regionScored", visibility: "public", region: amounts.region, ...points });
    const to = Math.max(-end, Math.min(end, from + points.sae - points.lio));
    if (to === from) continue;
    pub.score = to;
    events.push({ kind: "scoreChanged", visibility: "public", from, to });
    const winner = atEnd(to, end);
    if (winner !== null) {
      pub.pending = [];
      pub.status = { kind: "over", winner, reason: "trackEnd" };
      return;
    }
    from = to;
  }
}

/** The winner after the final era: the side the track leans towards, or null when it is even or there is no track. */
export function leader(pub: PublicState): Side | null {
  if (pub.score === undefined || pub.score === 0) return null;
  return pub.score < 0 ? "lio" : "sae";
}

/** The score track a game with `map` starts with: `{ score }` when the map has scoring, otherwise nothing. */
export function scoreState(map: GameMap): { score?: number } {
  return map.scoring === undefined ? {} : { score: map.scoring.track.start };
}

const isWhole = (v: unknown, min: number): boolean => Number.isInteger(v) && (v as number) >= min;

/**
 * Why the map's scoring is unusable, or null. A map without scoring is fine. Run after the map's shape and ids are
 * checked. Never throws on bad input.
 */
export function scoringError(map: GameMap): string | null {
  const scoring: unknown = map.scoring;
  if (scoring === undefined) return null;
  if (typeof scoring !== "object" || scoring === null) return "The map's scoring must be an object.";
  const { track, regions } = scoring as Record<string, unknown>;
  if (typeof track !== "object" || track === null) return "The map's scoring needs a track { end, start }.";
  const { end, start } = track as Record<string, unknown>;
  if (!isWhole(end, 1)) return "The score track's end must be a whole number, 1 or more.";
  if (!Number.isInteger(start) || Math.abs(start as number) >= (end as number)) {
    return `The score track's start must be a whole number strictly between -${String(end)} and ${String(end)}.`;
  }
  if (!Array.isArray(regions)) return "The map's scoring regions must be a list.";
  const known = new Set(map.regions.map((r) => r.id));
  const seen = new Set<unknown>();
  for (const entry of regions as unknown[]) {
    if (typeof entry !== "object" || entry === null) return "Each scoring region must be an object.";
    const { region, ...amounts } = entry as Record<string, unknown>;
    if (!known.has(region as string)) return `The map's scoring names unknown region ${String(region)}.`;
    if (seen.has(region)) return `The map's scoring names region ${String(region)} twice.`;
    seen.add(region);
    for (const level of ["present", "ahead", "all"] as const) {
      if (!isWhole(amounts[level], 0)) {
        return `Region ${String(region)}'s ${level} amount must be a whole number, 0 or more.`;
      }
    }
  }
  const missing = map.regions.find((r) => !seen.has(r.id));
  return missing === undefined ? null : `The map's scoring does not name region ${missing.id}.`;
}
