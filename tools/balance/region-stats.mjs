// Region levels at each era's end, on a scenario with a map. They count control only: the level each side reaches
// in each region by the definitions in docs/design/map-and-points.md ("Scoring", "How a region scores"), with no
// amounts and no score track (those are score-stats.mjs). Control comes from the engine's own `controller`;
// the battlegrounds are the list of the era that is ending. Read from the public view only (hard rule 2).
import { controller } from "@terminal-dusk/engine";

export const SIDES = ["lio", "sae"];
/** A side's levels in a region, lowest first; a side counts only the highest it reaches. */
export const LEVELS = ["present", "ahead", "everyBattleground"];

const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places;
const rival = (side) => (side === "lio" ? "sae" : "lio");

/** The highest level `side` reaches in one region, or null: `count` holds both sides' countries and battlegrounds. */
function levelOf(side, count, battlegrounds) {
  const own = count[side];
  const other = count[rival(side)];
  if (battlegrounds > 0 && own.battlegrounds === battlegrounds) return "everyBattleground";
  const moreBattlegrounds = battlegrounds === 0 || own.battlegrounds > other.battlegrounds;
  if (own.countries > other.countries && moreBattlegrounds) return "ahead";
  return own.countries > 0 ? "present" : null;
}

/**
 * Per side, at the end of `era` in public view `pub`: countries and battlegrounds controlled on the whole map, and
 * how many regions it ends at each level (its highest only). A region with no battlegrounds that era counts
 * countries only for "ahead", and nobody holds every battleground there.
 */
export function regionLevels(pub, era) {
  const list = new Set(pub.map.battlegrounds.find((entry) => entry.era === era)?.countries ?? []);
  const zero = () => ({ countries: 0, battlegrounds: 0 });
  const result = Object.fromEntries(
    SIDES.map((s) => [s, { ...zero(), levels: Object.fromEntries(LEVELS.map((l) => [l, 0])) }]),
  );
  for (const region of pub.map.regions) {
    const count = { lio: zero(), sae: zero() };
    const countries = pub.map.countries.filter((c) => c.region === region.id);
    for (const country of countries) {
      const side = controller(pub, country.id);
      if (side === null) continue;
      count[side].countries += 1;
      if (list.has(country.id)) count[side].battlegrounds += 1;
    }
    const battlegrounds = countries.filter((c) => list.has(c.id)).length;
    for (const side of SIDES) {
      result[side].countries += count[side].countries;
      result[side].battlegrounds += count[side].battlegrounds;
      const level = levelOf(side, count, battlegrounds);
      if (level !== null) result[side].levels[level] += 1;
    }
  }
  return result;
}

/**
 * The report's era-end numbers for `summaries` (each with `eraEnds`, a list of { era, lio, sae } from regionLevels):
 * one row per era, in the order the games reached them, with per side the averages over the games that reached that
 * era's end. Undefined when no game has era ends.
 */
export function eraEndNumbers(summaries) {
  const byEra = new Map();
  for (const game of summaries) {
    for (const end of game.eraEnds ?? []) {
      if (!byEra.has(end.era)) byEra.set(end.era, []);
      byEra.get(end.era).push(end);
    }
  }
  if (byEra.size === 0) return undefined;
  return [...byEra].map(([era, ends]) => {
    const average = (pick) => round(ends.reduce((n, end) => n + pick(end), 0) / ends.length, 2);
    const side = (s) => ({
      countries: average((end) => end[s].countries),
      battlegrounds: average((end) => end[s].battlegrounds),
      levels: Object.fromEntries(LEVELS.map((l) => [l, average((end) => end[s].levels[l])])),
    });
    return { era, games: ends.length, lio: side("lio"), sae: side("sae") };
  });
}
