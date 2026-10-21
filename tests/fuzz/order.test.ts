import { describe, expect, it } from "vitest";
import { byCodeUnit } from "./order.ts";

describe("byCodeUnit", () => {
  it("sorts strings in the same order as a plain sort, capitals before small letters and c10 before c2", () => {
    const words = ["sae", "c2", "Lio", "c10", "lio", "b", "B", "c2"];
    expect([...words].sort(byCodeUnit)).toEqual(["B", "Lio", "b", "c10", "c2", "c2", "lio", "sae"]);
  });

  it("says two equal strings are equal", () => {
    expect(byCodeUnit("c1", "c1")).toBe(0);
  });
});
