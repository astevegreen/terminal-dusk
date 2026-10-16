import { describe, expect, it } from "vitest";
import { schemas } from "./index.ts";

describe("content schemas", () => {
  it("has no schemas yet, so no content can pass the content check", () => {
    expect(Object.keys(schemas)).toEqual([]);
  });
});
