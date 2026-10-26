// The map's closing order (R17b): createGame refuses a bad one with invalidSetup, one test per refusal, and keeps
// a good one in state.public.map as its own copy.
import { describe, expect, it } from "vitest";
import { createGame } from "./index.ts";
import type { EngineError, GameState, SetupMap } from "./index.ts";
import { ruleset } from "./test/game.ts";
import { mapSetup, testMap } from "./test/map.ts";

/** The test map changed by `edit`, given to createGame; the error it returns, or null. */
function refusal(edit: (map: SetupMap) => void): EngineError | null {
  const map = testMap();
  edit(map);
  const r = createGame(ruleset, mapSetup(map), "seed-1");
  return r.ok ? null : r.error;
}

describe("createGame and the map's closingOrder", () => {
  it("refuses a map with no closingOrder", () => {
    expect(refusal((m) => delete (m as Partial<SetupMap>).closingOrder)).toMatchObject({
      code: "invalidSetup",
      message: /closingOrder.*list of region ids/,
    });
  });
  it("refuses a closingOrder that is not a list of region ids", () => {
    expect(refusal((m) => ((m as unknown as { closingOrder: unknown }).closingOrder = "south"))).toMatchObject({
      code: "invalidSetup",
      message: /closingOrder.*list of region ids/,
    });
  });
  it("refuses a closingOrder with fewer than 3 ids", () => {
    expect(refusal((m) => (m.closingOrder = ["south", "east"]))).toMatchObject({
      code: "invalidSetup",
      message: /closingOrder.*exactly 3.*has 2/,
    });
  });
  it("refuses a closingOrder with more than 3 ids", () => {
    expect(refusal((m) => (m.closingOrder = ["south", "east", "north", "south"]))).toMatchObject({
      code: "invalidSetup",
      message: /closingOrder.*exactly 3.*has 4/,
    });
  });
  it("refuses a closingOrder naming an unknown region", () => {
    expect(refusal((m) => (m.closingOrder = ["south", "west", "north"]))).toMatchObject({
      code: "invalidSetup",
      message: /closingOrder.*unknown region west/,
    });
  });
  it("refuses a closingOrder naming a region twice", () => {
    expect(refusal((m) => (m.closingOrder = ["south", "east", "south"]))).toMatchObject({
      code: "invalidSetup",
      message: /closingOrder.*south twice/,
    });
  });
  it("keeps the closingOrder in state.public.map, in order, as a copy not shared with the setup", () => {
    const setup = mapSetup();
    const r = createGame(ruleset, setup, "seed-1");
    if (!r.ok) throw new Error(r.error.message);
    const state: GameState = r.value.state;
    expect(state.public.map!.closingOrder).toEqual(["south", "east", "north"]);
    expect(state.public.map!.closingOrder).not.toBe(setup.map!.closingOrder);
    setup.map!.closingOrder.reverse();
    expect(state.public.map!.closingOrder).toEqual(["south", "east", "north"]);
  });
});
