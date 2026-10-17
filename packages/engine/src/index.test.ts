import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/engine entry point", () => {
  it("exports exactly createGame and SIDES (types aside)", () => {
    expect(Object.keys(entry).sort()).toEqual(["SIDES", "createGame"]);
  });
});
