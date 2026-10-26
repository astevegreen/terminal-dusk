// The fuzz checks for the map and influence (R15, docs/design/map-and-points.md, "Influence"): influence is never
// negative, has one entry per map country in the map's order, and the map never changes during a game.
// checkStep (checks.ts) runs them on every state.
import { SIDES } from "@terminal-dusk/engine";
import type { GameState, Setup } from "@terminal-dusk/engine";

type PublicState = GameState["public"];
type InfluenceEntry = NonNullable<PublicState["influence"]>[number];

/** The keys of `value`, sorted alphabetically. */
function sortedKeys(value: object): string[] {
  return Object.keys(value).sort((a, b) => a.localeCompare(b));
}

/** `value` as JSON with every object's keys sorted, so two values compare equal whatever their key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const fields = sortedKeys(record).map((k) => JSON.stringify(k) + ":" + canonical(record[k]));
    return "{" + fields.join(",") + "}";
  }
  return JSON.stringify(value);
}

/** A game started without a map never has `map` or `influence`. */
function checkNoMap(pub: PublicState): void {
  for (const field of ["map", "influence"] as const) {
    if (field in pub) throw new Error(`the game was started without a map, but its state has \`${field}\``);
  }
}

/** One influence entry has only `country`, `lio` and `sae`, and each count is a whole number, 0 or more. */
function checkEntry(entry: InfluenceEntry): void {
  const keys = sortedKeys(entry);
  if (JSON.stringify(keys) !== JSON.stringify(["country", "lio", "sae"])) {
    throw new Error(`the influence entry for ${entry.country} has the fields ${keys.join(", ")}`);
  }
  for (const side of SIDES) {
    const n: unknown = entry[side];
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
      throw new Error(`${side}'s influence in ${entry.country} is ${String(n)}, not a whole number 0 or more`);
    }
  }
}

/**
 * A game started without a map never has `map` or `influence`. With a map: `state.public.map` is the setup's map
 * without its starting influence, unchanged; `influence` has exactly one entry per map country, in the map's
 * country order, each with only `country`, `lio` and `sae`; and every count is a whole number, 0 or more.
 */
export function checkInfluence(setup: Setup, state: GameState): void {
  const pub = state.public;
  if (setup.map === undefined) {
    checkNoMap(pub);
    return;
  }
  const { regions, countries: mapCountries, homeBox } = setup.map;
  const fixed = { regions, countries: mapCountries, homeBox };
  if (canonical(pub.map) !== canonical(fixed)) {
    throw new Error(`the map ${canonical(pub.map)} is not the setup's map ${canonical(fixed)}`);
  }
  const influence = pub.influence;
  if (!Array.isArray(influence)) throw new Error("the game has a map, but its state has no influence list");
  const countries = influence.map((e) => e.country);
  const expected = mapCountries.map((c) => c.id);
  if (JSON.stringify(countries) !== JSON.stringify(expected)) {
    throw new Error(
      `the influence list is for ${JSON.stringify(countries)}, not one entry per map country in the map's ` +
        `order, ${JSON.stringify(expected)}`,
    );
  }
  for (const entry of influence) checkEntry(entry);
}
