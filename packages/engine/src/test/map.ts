// A small made-up map for engine tests: three regions, five countries in a ring with one cross link, and one
// country on its own.
import type { Setup, SetupMap } from "../types.ts";
import { makeSetup } from "./game.ts";

/**
 * Regions "north" (alpha, bravo, charlie), "south" (delta, echo) and "east" (foxtrot). Neighbours: alpha-bravo,
 * bravo-charlie, alpha-charlie, charlie-delta, delta-echo; foxtrot has none. LIO's home box touches alpha, SAE's
 * echo and delta. Era era-1's battlegrounds are charlie and delta. LIO starts with 2 in alpha and 1 in charlie,
 * SAE with 3 in echo and 1 in charlie. Made-up closing order: south at Escalation 3, then east at 4, then north at 5.
 */
export const testMap = (): SetupMap => ({
  regions: [
    { id: "north", name: "North" },
    { id: "south", name: "South" },
    { id: "east", name: "East" },
  ],
  closingOrder: ["south", "east", "north"],
  countries: [
    { id: "alpha", name: "Alpha", region: "north", stability: 2, neighbours: ["bravo", "charlie"] },
    { id: "bravo", name: "Bravo", region: "north", stability: 1, neighbours: ["alpha", "charlie"] },
    { id: "charlie", name: "Charlie", region: "north", stability: 3, neighbours: ["alpha", "bravo", "delta"] },
    { id: "delta", name: "Delta", region: "south", stability: 2, neighbours: ["charlie", "echo"] },
    { id: "echo", name: "Echo", region: "south", stability: 1, neighbours: ["delta"] },
    { id: "foxtrot", name: "Foxtrot", region: "east", stability: 1, neighbours: [] },
  ],
  battlegrounds: [{ era: "era-1", countries: ["charlie", "delta"] }],
  homeBox: { lio: ["alpha"], sae: ["echo", "delta"] },
  startingInfluence: [
    { country: "alpha", lio: 2, sae: 0 },
    { country: "echo", lio: 0, sae: 3 },
    { country: "charlie", lio: 1, sae: 1 },
  ],
});

/** makeSetup with the test map, or with `map` in its place, starting in era era-1. */
export const mapSetup = (map: SetupMap = testMap(), turns = 2, playsPerTurn = 1): Setup => ({
  ...makeSetup(turns, playsPerTurn),
  firstEra: "era-1",
  map,
});
