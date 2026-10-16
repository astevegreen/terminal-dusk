import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/server entry point", () => {
  it("loads and exports nothing yet, because no server code has been written", () => {
    expect(Object.keys(entry)).toEqual([]);
  });
});
