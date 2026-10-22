import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";
import { byCodeUnit } from "./test/order.ts";

describe("@terminal-dusk/host entry point", () => {
  it("exports hostCreate, hostSubmit, hostTimeout and hostArchive, and nothing else at run time (everything else it exports is a type)", () => {
    expect(Object.keys(entry).sort(byCodeUnit)).toEqual(["hostArchive", "hostCreate", "hostSubmit", "hostTimeout"]);
  });
});
