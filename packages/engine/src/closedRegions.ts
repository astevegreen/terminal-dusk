// Which regions are closed to interventions and realignments (docs/design/map-and-points.md, "Thresholds close
// regions"): below Escalation 3 none; at 3 the first region of the map's closing order, at 4 the first two, at 5
// (and 6) the first three. Placing influence is never blocked. Pure helpers on the public state, so the app and the
// AI can call them on a view's public part (docs/architecture.md, decision 6).
import type { PublicState, RegionId } from "./types.ts";

/** The first Escalation level that closes a region. */
export const FIRST_CLOSING_LEVEL = 3;
/** How many thresholds close a region (Escalation 3, 4 and 5), so how many regions a map's closing order names. */
export const CLOSING_THRESHOLDS = 3;

/**
 * The closed regions, in the map's closing order: a fresh list. Empty in a game without a map, and below
 * Escalation 3.
 */
export function closedRegions(state: PublicState): RegionId[] {
  const { map, escalation } = state;
  if (map === undefined || escalation === undefined) return [];
  const count = Math.min(CLOSING_THRESHOLDS, Math.max(0, escalation - FIRST_CLOSING_LEVEL + 1));
  return map.closingOrder.slice(0, count);
}

/** Whether `regionId` is closed now. An unknown region, or a game without a map, gives false. */
export function isRegionClosed(state: PublicState, regionId: RegionId): boolean {
  return closedRegions(state).includes(regionId);
}
