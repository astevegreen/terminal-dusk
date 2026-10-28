// Era-end region scoring's types (docs/design/map-and-points.md, "Scoring"): the map's scoring data and the score
// track's events. types.ts re-exports them, so index.ts exports the same names.
import type { RegionId } from "./mapTypes.ts";

/**
 * What one region is worth to a side at an era's end, by its highest level: `present` (it controls a country there),
 * `ahead` (more countries and more battlegrounds than the rival) or `all` (it controls every battleground). Whole
 * numbers, 0 or more: scenario data.
 */
export type RegionAmounts = { region: RegionId; present: number; ahead: number; all: number };

/**
 * A map's scoring. `track.end` is each side's end of the shared score track: LIO wins at -end, SAE at +end. The track
 * starts at `track.start`, a whole number strictly between them. `regions` names every region of the map once, in the
 * order they score.
 */
export type MapScoring = { track: { end: number; start: number }; regions: RegionAmounts[] };

/** `region` scored at an era's end: `lio` and `sae` are each side's points. One event per region that scores. */
export type RegionScored = { kind: "regionScored"; visibility: "public"; region: RegionId; lio: number; sae: number };
/** The score track moved from `from` to `to`: one event for each change of value. */
export type ScoreChanged = { kind: "scoreChanged"; visibility: "public"; from: number; to: number };
/** Every score event: both are public. */
export type ScoreEvent = RegionScored | ScoreChanged;
