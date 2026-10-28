// The content test map (TEST_MAP_SCENARIO) in the fuzz games, with a battleground list for each random era (#429).
import { scenarioSetup, TEST_MAP_SCENARIO } from "@terminal-dusk/content";
import type { Setup } from "@terminal-dusk/engine";

/**
 * `setup` on a fresh copy of the content test map, starting in the map scenario's first era. Each name among the
 * setup's later eras (the random ones are all "fuzz", which share a list) gets one list, every other map country,
 * unless the map already has one, so the battlegrounds change once a later era enters.
 */
export function onTestMap(setup: Setup): Setup {
  const { firstEra, map } = scenarioSetup(TEST_MAP_SCENARIO);
  if (firstEra === undefined || map === undefined) throw new Error("the test map scenario has no map or first era");
  const listed = new Set(map.battlegrounds.map((list) => list.era));
  const names = [...new Set((setup.eras ?? []).map((entry) => entry.era))].filter((era) => !listed.has(era));
  const countries = map.countries.filter((_, i) => i % 2 === 0).map((c) => c.id);
  const later = names.map((era) => ({ era, countries }));
  return { ...setup, firstEra, map: { ...map, battlegrounds: [...map.battlegrounds, ...later] } };
}
