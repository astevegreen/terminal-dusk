import { describe, expect, it } from "vitest";
import { createOnlineRefusal, isEntitlement, isPlatform, PLATFORMS } from "./entitlement.ts";
import type { Entitlement, Platform } from "./entitlement.ts";
import { deepFreeze } from "./test/deepFreeze.ts";

const web: Entitlement = { platform: "web", source: "checkout" };
const steam: Entitlement = { platform: "steam", source: "steam" };
const ios: Entitlement = { platform: "ios", source: "appStore" };

const refuse = (entitlements: unknown, platform: unknown) =>
  createOnlineRefusal(entitlements as Entitlement[], platform as Platform);
const codeOf = (entitlements: unknown, platform: unknown): string | null =>
  refuse(entitlements, platform)?.code ?? null;

describe("entitlement: platforms and guards", () => {
  it("PLATFORMS lists web, steam, ios and android, in that order", () => {
    expect(PLATFORMS).toEqual(["web", "steam", "ios", "android"]);
  });

  it("isPlatform accepts the four platforms and nothing else", () => {
    for (const p of PLATFORMS) expect(isPlatform(p)).toBe(true);
    for (const bad of ["Web", "xbox", "", null, undefined, 1, {}, ["web"]]) expect(isPlatform(bad)).toBe(false);
  });

  it("isEntitlement needs a known platform and a non-empty source string", () => {
    expect(isEntitlement(web)).toBe(true);
    expect(isEntitlement({ platform: "android", source: "googlePlay" })).toBe(true);
    for (const bad of [
      null,
      undefined,
      "web",
      [],
      {},
      { platform: "web" },
      { platform: "web", source: "" },
      { platform: "web", source: 1 },
      { platform: "xbox", source: "store" },
      { source: "checkout" },
    ])
      expect(isEntitlement(bad)).toBe(false);
  });
});

describe("createOnlineRefusal: who may create an online game", () => {
  it("no entitlements: refused with notEntitled and a plain-English message", () => {
    const error = refuse([], "web");
    expect(error?.code).toBe("notEntitled");
    expect(error?.message).toMatch(/full game/i);
    expect(error?.message).toMatch(/platform/i);
  });

  it("one entitlement for this platform: allowed", () => {
    expect(refuse([web], "web")).toBeNull();
  });

  it("only entitlements for other platforms: refused with notEntitled", () => {
    expect(codeOf([steam, ios], "web")).toBe("notEntitled");
    expect(codeOf([web], "android")).toBe("notEntitled");
  });

  it("several entitlements including one for this platform: allowed", () => {
    expect(refuse([steam, web, ios], "web")).toBeNull();
    expect(refuse([steam, web, ios], "ios")).toBeNull();
  });

  it("an unknown platform: invalidConfig, never a throw", () => {
    for (const bad of ["xbox", "", null, undefined, 3]) expect(codeOf([web], bad)).toBe("invalidConfig");
  });

  it("a non-array: invalidConfig, never a throw", () => {
    for (const bad of [null, undefined, web, "web", 1, {}]) expect(codeOf(bad, "web")).toBe("invalidConfig");
  });

  it("a bad element after a matching one: invalidConfig, so the whole input is checked first", () => {
    expect(codeOf([web, null], "web")).toBe("invalidConfig");
    expect(codeOf([web, { platform: "xbox", source: "store" }], "web")).toBe("invalidConfig");
    expect(codeOf([web, "steam"], "web")).toBe("invalidConfig");
  });

  it("an empty source: invalidConfig, even for the stated platform", () => {
    expect(codeOf([{ platform: "web", source: "" }], "web")).toBe("invalidConfig");
    expect(codeOf([web, { platform: "steam", source: "" }], "web")).toBe("invalidConfig");
  });

  it("never changes its inputs (frozen inputs)", () => {
    const entitlements = deepFreeze([steam, web]);
    expect(() => createOnlineRefusal(entitlements, "web")).not.toThrow();
    expect(createOnlineRefusal(entitlements, "web")).toBeNull();
    expect(createOnlineRefusal(entitlements, "ios")?.code).toBe("notEntitled");
    expect(entitlements).toEqual([steam, web]);
  });
});
