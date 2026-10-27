// Intervening (R16b; docs/design/map-and-points.md, "Points and actions" 2). A side spending points picks one
// action for all of them (owner, 26 Oct, #316: points cannot be split). To intervene it picks a country where the
// rival has influence (no adjacency needed), draws one card from its own Contingency deck (a side's own action,
// contingency-deck.md), and the result is draw + points - 2 x stability. Above 0, that much rival influence comes
// off (stopping at 0) and the rest goes on as the side's own. A region Escalation has closed takes no
// interventions ("Thresholds close regions"). Escalation rising for a battleground is R17, not here.
import { isRegionClosed } from "./closedRegions.ts";
import { drawContingency } from "./contingency.ts";
import { addInfluence, removeInfluence } from "./influence.ts";
import { otherSide } from "./types.ts";
import type { CountryId, GameEvent, GameState, PublicState, Side } from "./types.ts";

/**
 * The countries `side` may intervene in now, in the map's order: the rival has 1 or more influence there and the
 * country's region is not closed. Empty in a game without a map. Reads only the public state.
 */
export function interveneTargets(state: PublicState, side: Side): CountryId[] {
  const rival = otherSide(side);
  const has = (id: CountryId): boolean => (state.influence?.find((e) => e.country === id)?.[rival] ?? 0) > 0;
  return (state.map?.countries ?? []).filter((c) => !isRegionClosed(state, c.region) && has(c.id)).map((c) => c.id);
}

/**
 * Runs one intervention by `side` in `country` with `points`: draws from `side`'s Contingency deck, then removes
 * and adds influence by the result, and tells everyone (intervened). Edits `state`, apply's working copy, in
 * place. The caller has checked `country` against interveneTargets.
 */
export function intervene(state: GameState, side: Side, country: CountryId, points: number, events: GameEvent[]): void {
  const rival = otherSide(side);
  const stability = state.public.map?.countries.find((c) => c.id === country)?.stability ?? 0;
  const rivalHas = state.public.influence?.find((e) => e.country === country)?.[rival] ?? 0;
  const draw = drawContingency(state, side, events);
  const result = draw + points - 2 * stability;
  const gain = Math.max(0, result);
  const removed = Math.min(gain, rivalHas);
  const added = gain - removed;
  const changed = addInfluence(removeInfluence(state, rival, country, removed), side, country, added);
  if (changed.public.influence !== undefined) state.public.influence = changed.public.influence;
  events.push({
    kind: "intervened",
    visibility: "public",
    side,
    country,
    stability,
    points,
    draw,
    result,
    removed,
    added,
  });
}
