// A numbers file (--numbers): a proposal's stabilities, battleground lists and starting influence, laid over a map
// scenario's own for one run. Only this run's match config changes; the scenario file does not. The engine still
// checks the result when the host starts a game (battleground lists per era, known countries).
import { readFileSync } from "node:fs";

const KEYS = ["name", "stability", "battlegrounds", "startingInfluence"];
const WHOLE = (n, min) => Number.isInteger(n) && n >= min;
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** The numbers in the JSON file at `file`; throws a message naming the file when it cannot be read or parsed. */
export function readNumbers(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    throw new Error(`--numbers cannot read ${file} (${err.code ?? err.message}).`, { cause: err });
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`--numbers file ${file} is not JSON (${err.message}).`, { cause: err });
  }
}

/**
 * Why `numbers` does not fit `map` (a setup map), or null. Every part is optional:
 * - `name`: a line of text for the report title;
 * - `stability`: country id -> whole number from 1 up;
 * - `battlegrounds`: era id -> country ids, each once; only eras the map has a list for;
 * - `startingInfluence`: [{ country, lio, sae }], each country once, whole numbers from 0 up.
 */
export function numbersError(numbers, map) {
  if (!isObject(numbers)) return "The numbers file must hold one JSON object.";
  const unknownKey = Object.keys(numbers).find((key) => !KEYS.includes(key));
  if (unknownKey !== undefined) return `Unknown key "${unknownKey}"; the keys are ${KEYS.join(", ")}.`;
  if (numbers.name !== undefined && typeof numbers.name !== "string") return '"name" must be text.';
  const ids = new Set(map.countries.map((c) => c.id));
  const known = (id, where) => (ids.has(id) ? null : `${where} names unknown country "${id}".`);
  if (numbers.stability !== undefined) {
    if (!isObject(numbers.stability)) return '"stability" must map country ids to whole numbers.';
    for (const [id, value] of Object.entries(numbers.stability)) {
      const error = known(id, '"stability"');
      if (error !== null) return error;
      if (!WHOLE(value, 1)) return `The stability of ${id} must be a whole number from 1 up, not ${value}.`;
    }
  }
  if (numbers.battlegrounds !== undefined) {
    if (!isObject(numbers.battlegrounds)) return '"battlegrounds" must map era ids to lists of country ids.';
    const eras = new Set(map.battlegrounds.map((list) => list.era));
    for (const [era, list] of Object.entries(numbers.battlegrounds)) {
      if (!eras.has(era)) return `"battlegrounds" names era ${era}, which the map has no list for.`;
      if (!Array.isArray(list)) return `Era ${era}'s battlegrounds must be a list of country ids.`;
      if (new Set(list).size !== list.length) return `Era ${era}'s battlegrounds name a country twice.`;
      const error = list.map((id) => known(id, `Era ${era}'s battlegrounds`)).find((e) => e !== null);
      if (error !== undefined) return error;
    }
  }
  if (numbers.startingInfluence !== undefined) return influenceError(numbers.startingInfluence, known);
  return null;
}

function influenceError(entries, known) {
  if (!Array.isArray(entries)) return '"startingInfluence" must be a list of { country, lio, sae }.';
  const seen = new Set();
  for (const entry of entries) {
    if (!isObject(entry)) return '"startingInfluence" must be a list of { country, lio, sae }.';
    const error = known(entry.country, '"startingInfluence"');
    if (error !== null) return error;
    if (seen.has(entry.country)) return `"startingInfluence" names ${entry.country} twice.`;
    seen.add(entry.country);
    if (!WHOLE(entry.lio, 0) || !WHOLE(entry.sae, 0)) {
      return `The starting influence in ${entry.country} must be whole numbers from 0 up.`;
    }
  }
  return null;
}

/**
 * `config` with `numbers` laid over its map: named stabilities replace the map's, named eras' battleground lists
 * replace theirs, and a starting influence list replaces the whole of the map's. What is not named stays. Throws
 * when the numbers do not fit (numbersError) or the config has no map. `config` itself is not changed.
 */
export function applyNumbers(config, numbers) {
  const map = config.setup.map;
  if (map === undefined) throw new Error("--numbers needs a scenario with a map (test-map or six-region).");
  const error = numbersError(numbers, map);
  if (error !== null) throw new Error(`--numbers: ${error}`);
  const stability = numbers.stability ?? {};
  const battlegrounds = numbers.battlegrounds ?? {};
  const next = {
    ...map,
    countries: map.countries.map((c) => ({ ...c, stability: stability[c.id] ?? c.stability })),
    battlegrounds: map.battlegrounds.map((list) => ({
      era: list.era,
      countries: [...(battlegrounds[list.era] ?? list.countries)],
    })),
    startingInfluence: (numbers.startingInfluence ?? map.startingInfluence).map(({ country, lio, sae }) => ({
      country,
      lio,
      sae,
    })),
  };
  return { ...config, setup: { ...config.setup, map: next } };
}
