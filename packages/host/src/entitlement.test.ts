import { describe, expect, it } from "vitest";
import {
  createOnlineRefusal,
  isEntitlement,
  isPlatform,
  joinRankedRefusal,
  ownsFullGame,
  PLATFORMS,
} from "./entitlement.ts";
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

describe("joinRankedRefusal: who may join a ranked game (#687)", () => {
  const ranked = (entitlements: unknown, platform: unknown) =>
    joinRankedRefusal(entitlements as Entitlement[], platform as Platform);

  it("no entitlements: refused with notEntitled; the words say joining a ranked game needs the full game", () => {
    const error = ranked([], "web");
    expect(error?.code).toBe("notEntitled");
    expect(error?.message).toMatch(/joining a ranked game needs the full game on this platform/i);
  });

  it("the words say an invited private game is still open, never that it is closed", () => {
    const message = ranked([], "web")?.message;
    expect(message).toContain("You can still join a private game you are invited to.");
    expect(message).not.toMatch(/can(no|')t|creat/i);
  });

  it("an entitlement for this platform: allowed", () => {
    expect(ranked([web], "web")).toBeNull();
    expect(ranked([steam, web, ios], "ios")).toBeNull();
  });

  it("only entitlements for other platforms: refused, since there is no cross-platform unlock", () => {
    expect(ranked([steam, ios], "web")?.code).toBe("notEntitled");
    expect(ranked([web], "android")?.code).toBe("notEntitled");
  });

  it("checks its input as createOnlineRefusal does: invalidConfig with the same words, never a throw", () => {
    const bad: [unknown, unknown][] = [
      [[web], "xbox"],
      [[web], undefined],
      [null, "web"],
      [web, "web"],
      [[web, null], "web"],
      [[web, { platform: "steam", source: "" }], "web"],
    ];
    for (const [entitlements, platform] of bad) {
      expect(ranked(entitlements, platform)?.code).toBe("invalidConfig");
      expect(ranked(entitlements, platform)).toEqual(refuse(entitlements, platform));
    }
  });

  it("never changes its inputs (frozen inputs)", () => {
    const entitlements = deepFreeze([steam, web]);
    expect(joinRankedRefusal(entitlements, "web")).toBeNull();
    expect(joinRankedRefusal(entitlements, "ios")?.code).toBe("notEntitled");
    expect(entitlements).toEqual([steam, web]);
  });
});

describe("ownsFullGame: whether the player owns the Full Game on this platform (#647)", () => {
  const owns = (entitlements: unknown, platform: unknown) =>
    ownsFullGame(entitlements as Entitlement[], platform as Platform);

  it("an entitlement for that platform: true", () => {
    expect(owns([web], "web")).toBe(true);
    expect(owns([steam, web, ios], "ios")).toBe(true);
  });

  it("only entitlements for another platform: false", () => {
    expect(owns([steam, ios], "web")).toBe(false);
    expect(owns([web], "android")).toBe(false);
  });

  it("no entitlements: false", () => {
    expect(owns([], "web")).toBe(false);
  });

  it("a malformed list or platform: false, never a throw", () => {
    for (const bad of [null, undefined, web, "web", 1, {}]) expect(owns(bad, "web")).toBe(false);
    expect(owns([web, null], "web")).toBe(false);
    expect(owns([{ platform: "web", source: "" }], "web")).toBe(false);
    for (const bad of ["xbox", "", null, undefined]) expect(owns([web], bad)).toBe(false);
  });

  it("agrees with createOnlineRefusal on every well-formed input", () => {
    for (const list of [[], [web], [steam, ios], [steam, web, ios]])
      for (const platform of PLATFORMS)
        expect(ownsFullGame(list, platform)).toBe(createOnlineRefusal(list, platform) === null);
  });

  it("never changes its inputs (frozen inputs)", () => {
    const entitlements = deepFreeze([steam, web]);
    expect(ownsFullGame(entitlements, "web")).toBe(true);
    expect(entitlements).toEqual([steam, web]);
  });
});
