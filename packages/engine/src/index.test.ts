import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/engine entry point", () => {
  it("exports exactly the public functions and SIDES (types aside)", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "SIDES",
      "apply",
      "createGame",
      "eventsFor",
      "hiddenPart",
      "legalAnswers",
      "pendingFor",
      "reconstruct",
      "seedHash",
      "verifyGame",
      "viewFor",
    ]);
  });
});
