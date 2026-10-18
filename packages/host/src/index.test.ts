import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";

describe("@terminal-dusk/host entry point", () => {
  it("exports hostCreate, hostSubmit and hostArchive, and nothing else at run time (everything else it exports is a type)", () => {
    expect(Object.keys(entry).sort()).toEqual(["hostArchive", "hostCreate", "hostSubmit"]);
  });
});
