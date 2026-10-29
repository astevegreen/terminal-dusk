// The choices of a decision that each name one country (L7, #487): a placing, an intervention in the action menu,
// a realignment. Built only from the decision's own options, never from the rules (docs/architecture.md, Decision 6),
// and named by the country's name from the frame's public map, never by its id. The prompts (decisionPrompts.tsx)
// list them, and the map draws each as a glowing country you tap (map/Marker.tsx) or a button in the List.
import type { CountryId, Decision, GameMap } from "@terminal-dusk/engine";
import type { Choice } from "./promptChoices.tsx";

/** A country's name on screen, looked up by its id. Display data only. */
export type CountryName = (country: CountryId) => string;

/** The names from `map`; a country the map lacks (or a game with no map) shows its id, as nothing better is known. */
export function countryNames(map: GameMap | undefined): CountryName {
  const names = new Map((map?.countries ?? []).map((c) => [c.id, c.name]));
  return (country) => names.get(country) ?? country;
}

/** A choice that names `country`: its text, the answer it sends, and the country it is for. */
const choice = (text: string, country: CountryId, value: Choice["value"]): Choice => ({ text, value, country });

/**
 * The decision's country choices, in the order its options list them: "Place in Ukraine", "Intervene in Ukraine"
 * (only when the action menu offers an intervention), "Realign in Ukraine". Empty for any other decision.
 */
export function countryChoices(decision: Decision, name: CountryName): Choice[] {
  const options = decision.options;
  switch (decision.kind) {
    case "placeInfluence":
      return ("countries" in options ? options.countries : []).map((country) =>
        choice(`Place in ${name(country)}`, country, { kind: "placeInfluence", country }),
      );
    case "chooseAction": {
      const offered = "actions" in options && options.actions.includes("intervene");
      return (offered && "targets" in options ? options.targets : []).map((country) =>
        choice(`Intervene in ${name(country)}`, country, { kind: "chooseAction", action: "intervene", country }),
      );
    }
    case "realign":
      return ("attempts" in options ? options.targets : []).map((country) =>
        choice(`Realign in ${name(country)}`, country, { kind: "realign", country }),
      );
    default:
      return [];
  }
}

/** The choices that name a country, keyed by it: what the map lets you tap. */
export function picksByCountry(choices: readonly Choice[]): ReadonlyMap<CountryId, Choice> {
  const picks = new Map<CountryId, Choice>();
  for (const c of choices) if (c.country !== undefined && !picks.has(c.country)) picks.set(c.country, c);
  return picks;
}
