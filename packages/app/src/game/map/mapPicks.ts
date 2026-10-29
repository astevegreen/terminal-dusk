// The countries the waiting decision lets you pick (L7, #487), as the drawn map and the List get them: each one's
// choice (countryChoices.ts) and what a tap on it does. Built in ZoomableMap from the decision's options only.
import type { CountryId } from "@terminal-dusk/engine";
import type { Choice } from "../../promptChoices.tsx";
import type { PickHandlers, PickState } from "./Marker.tsx";

export type MapPicks = {
  /** The country choices, keyed by country; empty when the waiting decision names none. */
  choices: ReadonlyMap<CountryId, Choice>;
  /** The drawn map's handlers: a tap answers, or zooms in first while the marker is too small to tap. */
  on: PickHandlers;
  /** The List answers at once: its buttons are always large enough. */
  answer: (choice: Choice) => void;
};

/** A country's state on the map: glowing when you may pick it, dim when a country decision waits but not for it. */
export function pickState(picks: MapPicks | undefined, country: CountryId): PickState {
  if (picks === undefined || picks.choices.size === 0) return null;
  return picks.choices.has(country) ? "glow" : "dim";
}
