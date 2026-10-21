import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/server entry point", () => {
  it("exports the submit handler, the in-memory store and the read model, and nothing else at run time", () => {
    expect(Object.keys(entry).sort()).toEqual(["MemoryStore", "VIEWERS", "canRead", "readMatch", "rowsFor", "submit"]);
  });
});
