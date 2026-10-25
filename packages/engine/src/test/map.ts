// A small made-up map for engine tests: two regions, five countries in a ring with one cross link.
import type { Setup, SetupMap } from "../types.ts";
import { makeSetup } from "./game.ts";

/**
 * Regions "north" (alpha, bravo, charlie) and "south" (delta, echo). Neighbours: alpha-bravo, bravo-charlie,
 * alpha-charlie, charlie-delta, delta-echo. LIO's home box touches alpha, SAE's echo and delta. Charlie and
 * delta are battlegrounds. LIO starts with 2 in alpha and 1 in charlie, SAE with 3 in echo and 1 in charlie.
 */
export const testMap = (): SetupMap => ({
  regions: [
    { id: "north", name: "North" },
    { id: "south", name: "South" },
  ],
  countries: [
    {
      id: "alpha",
      name: "Alpha",
      region: "north",
      stability: 2,
      battleground: false,
      neighbours: ["bravo", "charlie"],
    },
    {
      id: "bravo",
      name: "Bravo",
      region: "north",
      stability: 1,
      battleground: false,
      neighbours: ["alpha", "charlie"],
    },
    {
      id: "charlie",
      name: "Charlie",
      region: "north",
      stability: 3,
      battleground: true,
      neighbours: ["alpha", "bravo", "delta"],
    },
    { id: "delta", name: "Delta", region: "south", stability: 2, battleground: true, neighbours: ["charlie", "echo"] },
    { id: "echo", name: "Echo", region: "south", stability: 1, battleground: false, neighbours: ["delta"] },
  ],
  homeBox: { lio: ["alpha"], sae: ["echo", "delta"] },
  startingInfluence: [
    { country: "alpha", lio: 2, sae: 0 },
    { country: "echo", lio: 0, sae: 3 },
    { country: "charlie", lio: 1, sae: 1 },
  ],
});

/** makeSetup with the test map, or with `map` in its place. */
export const mapSetup = (map: SetupMap = testMap(), turns = 2, playsPerTurn = 1): Setup => ({
  ...makeSetup(turns, playsPerTurn),
  map,
});
