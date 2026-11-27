// The eras' shown names, built from packages/content/eras/ (docs/design/eras.md).
import type { EraId } from "@terminal-dusk/engine";
import raw from "../eras/eras.json" with { type: "json" };
import { erasSchema } from "../schema/eras.ts";

const { eras } = erasSchema.parse(raw);

/** Each era by its name, number and years, "The Shock (Era 2, 2001–2008)"; one with no name by its label and years. */
export const ERA_NAMES: Readonly<Record<EraId, string>> = Object.fromEntries(
  eras.map((e) => {
    const years = `${e.from}–${e.to}`;
    return [e.id, e.name === undefined ? `${e.label} (${years})` : `${e.name} (${e.label}, ${years})`];
  }),
);

/** The same without the years, "The Shock (Era 2)", for where there is no room for them. */
export const ERA_TITLES: Readonly<Record<EraId, string>> = Object.fromEntries(
  eras.map((e) => [e.id, e.name === undefined ? e.label : `${e.name} (${e.label})`]),
);
