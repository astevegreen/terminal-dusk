import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/server entry point", () => {
  it("exports the submit handler and the in-memory store, and nothing else at run time (the port is a type)", () => {
    expect(Object.keys(entry).sort()).toEqual(["MemoryStore", "submit"]);
  });
});
