// The real-geography map's artwork (L3, #479), made by `pnpm map:build` from the sources in SOURCES.md: the Blue
// Marble picture, and each game country's shape and the land borders, in the map's units. Presentation only, keyed
// by country (docs/architecture.md, Decision 4): nothing here is in the game's state.
import type { WorldArt } from "../layout.ts";
// Built into the page (`?inline`), so the map has its picture offline, as in the tutorial (#642).
import picture from "./blueMarble.webp?inline";
import drawn from "./worldArt.json" with { type: "json" };

export const WORLD_ART: WorldArt = {
  picture,
  credit: "Blue Marble imagery: NASA Earth Observatory",
  shapes: drawn.shapes,
  borders: drawn.borders,
};
