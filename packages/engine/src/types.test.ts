import { describe, expect, it } from "vitest";
import { otherSide } from "./types.ts";

describe("otherSide", () => {
  it("gives sae for lio and lio for sae", () => {
    expect(otherSide("lio")).toBe("sae");
    expect(otherSide("sae")).toBe("lio");
  });
});
