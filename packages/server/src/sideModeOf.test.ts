// O12, acceptance criterion 1: `sideModeOf` sorts its keys with an explicit compare function, and its
// results are unchanged.
import { describe, expect, it } from "vitest";
import { sideModeOf } from "./invite.ts";

describe("sideModeOf accepts exactly the three side modes", () => {
  it("accepts each valid side mode as a copy", () => {
    expect(sideModeOf({ mode: "random" })).toEqual({ mode: "random" });
    expect(sideModeOf({ mode: "invitee" })).toEqual({ mode: "invitee" });
    expect(sideModeOf({ mode: "host", hostSide: "lio" })).toEqual({ mode: "host", hostSide: "lio" });
    expect(sideModeOf({ mode: "host", hostSide: "sae" })).toEqual({ mode: "host", hostSide: "sae" });
  });

  it("accepts the host mode with its keys given in reverse order", () => {
    expect(sideModeOf({ hostSide: "lio", mode: "host" })).toEqual({ mode: "host", hostSide: "lio" });
  });

  it("refuses a wrongly cased key on the two-key host mode", () => {
    expect(sideModeOf({ mode: "host", HostSide: "lio" })).toBeNull();
    expect(sideModeOf({ Mode: "host", hostSide: "lio" })).toBeNull();
    expect(sideModeOf({ Mode: "random" })).toBeNull();
  });

  it("refuses an extra key", () => {
    expect(sideModeOf({ mode: "random", hostSide: "lio" })).toBeNull();
    expect(sideModeOf({ mode: "invitee", extra: 1 })).toBeNull();
    expect(sideModeOf({ mode: "host", hostSide: "lio", extra: 1 })).toBeNull();
  });

  it("refuses a missing key", () => {
    expect(sideModeOf({ mode: "host" })).toBeNull();
    expect(sideModeOf({ hostSide: "lio" })).toBeNull();
    expect(sideModeOf({})).toBeNull();
  });

  it("refuses an unknown mode or side, and anything that is not a plain object", () => {
    expect(sideModeOf({ mode: "other" })).toBeNull();
    expect(sideModeOf({ mode: "host", hostSide: "neu" })).toBeNull();
    expect(sideModeOf(null)).toBeNull();
    expect(sideModeOf(["mode"])).toBeNull();
    expect(sideModeOf("random")).toBeNull();
  });
});
