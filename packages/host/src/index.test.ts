import { describe, expect, it } from "vitest";
import * as entry from "./index.ts";
import { byCodeUnit } from "./test/order.ts";

describe("@terminal-dusk/host entry point", () => {
  it("exports the five host calls, the online-create rule (createOnlineRefusal, isEntitlement, isPlatform, PLATFORMS), and nothing else at run time (everything else it exports is a type)", () => {
    expect(Object.keys(entry).sort(byCodeUnit)).toEqual([
      "PLATFORMS",
      "createOnlineRefusal",
      "hostArchive",
      "hostCreate",
      "hostDeadline",
      "hostSubmit",
      "hostTimeout",
      "isEntitlement",
      "isPlatform",
    ]);
  });
});
