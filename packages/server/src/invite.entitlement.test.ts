// O9c: a free player cannot create a private game. createInvite looks up the host's entitlements only after the
// cheaper checks pass, refuses a host without the full game on the stated platform, and never looks at
// entitlements when someone previews or joins (docs/architecture.md, Decision 5).
import { createOnlineRefusal } from "@terminal-dusk/host";
import type { Entitlement, Platform } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import type { EntitlementStore } from "./entitlementStore.ts";
import { createInvite, joinInvite, previewInvite } from "./invite.ts";
import type { CreateInviteRequest, InviteDeps } from "./invite.ts";
import type { SideMode } from "./inviteStore.ts";
import { HOST, INVITE_NOW, inviteWorld, JOINER } from "./test/invites.ts";

const refused = (code: string) => ({ ok: false, error: expect.objectContaining({ code }) });
const RANDOM: SideMode = { mode: "random" };
const create = (deps: InviteDeps, fields: Partial<CreateInviteRequest> = {}) =>
  createInvite(deps, { host: HOST, sides: RANDOM, platform: "web", now: INVITE_NOW, ...fields });

/** An entitlement store that records each player it is asked about and answers with `answer`. */
function spyStore(answer: () => Promise<Entitlement[]>): { store: EntitlementStore; asked: string[] } {
  const asked: string[] = [];
  return {
    store: {
      forPlayer(player) {
        asked.push(player);
        return answer();
      },
    },
    asked,
  };
}

describe("createInvite: a free player cannot create a private game", () => {
  it("a free creator is refused with notEntitled and the host's message, and no invite is stored", async () => {
    const { deps, invites } = inviteWorld();
    const made = await create(deps, { host: JOINER });
    const expected = createOnlineRefusal([], "web");
    expect(made).toEqual({ ok: false, error: { code: "notEntitled", message: expected?.message } });
    expect(await invites.find("CODE0001")).toBeNull();
  });

  it("an entitlement for another platform is refused", async () => {
    const { deps, invites, entitlements } = inviteWorld();
    await entitlements.grant(JOINER, { platform: "steam", source: "test" });
    expect(await create(deps, { host: JOINER, platform: "ios" })).toEqual(refused("notEntitled"));
    expect(await create(deps, { platform: "android" })).toEqual(refused("notEntitled"));
    expect(await invites.find("CODE0001")).toBeNull();
  });

  it("an entitlement for the stated platform is allowed", async () => {
    const { deps, invites, entitlements } = inviteWorld();
    await entitlements.grant(JOINER, { platform: "steam", source: "test" });
    await entitlements.grant(JOINER, { platform: "ios", source: "test" });
    expect(await create(deps, { host: JOINER, platform: "ios" })).toEqual({ ok: true, value: { code: "CODE0001" } });
    expect(await invites.find("CODE0001")).toMatchObject({ host: JOINER, sides: RANDOM });
    expect(await create(deps)).toEqual({ ok: true, value: { code: "CODE0002" } });
  });

  for (const [name, platform] of [
    ["an unknown platform", "xbox"],
    ["a platform in the wrong case", "Web"],
    ["an empty platform", ""],
    ["a missing platform", undefined],
    ["a number", 1],
    ["null", null],
  ] as [string, unknown][]) {
    it(`${name} is refused as invalidInvite, naming the four platforms, before any lookup`, async () => {
      const { deps, invites } = inviteWorld();
      const spy = spyStore(() => Promise.resolve([{ platform: "web", source: "test" }]));
      const made = await create({ ...deps, entitlements: spy.store }, { platform: platform as Platform });
      expect(made).toEqual(refused("invalidInvite"));
      const message = made.ok ? "" : (made.error.message ?? "");
      for (const known of ["web", "steam", "ios", "android"]) expect(message).toContain(known);
      expect(spy.asked).toEqual([]);
      expect(await invites.find("CODE0001")).toBeNull();
    });
  }

  it("checks signed in, then time, then platform, then side mode, and looks up entitlements only after them", async () => {
    const { deps } = inviteWorld();
    const spy = spyStore(() => Promise.resolve([]));
    const spied = { ...deps, entitlements: spy.store };
    const badSides = { mode: "nope" } as unknown as SideMode;
    const bad = { sides: badSides, platform: "xbox" as Platform, now: -1 };
    expect(await create(spied, { ...bad, host: "" })).toEqual(refused("notSignedIn"));
    expect(await create(spied, bad)).toEqual(refused("invalidTime"));
    const platformRefusal = await create(spied, { ...bad, now: INVITE_NOW });
    expect(platformRefusal).toEqual(refused("invalidInvite"));
    expect(JSON.stringify(platformRefusal)).toContain("android");
    const sidesRefusal = await create(spied, { sides: badSides });
    expect(sidesRefusal).toEqual(refused("invalidInvite"));
    expect(JSON.stringify(sidesRefusal)).toContain("side mode");
    expect(spy.asked).toEqual([]);
    expect(await create(spied, { host: JOINER })).toEqual(refused("notEntitled"));
    expect(spy.asked).toEqual([JOINER]);
  });

  it("a throwing entitlement store gives storageFailed with none of the thrown text, and stores nothing", async () => {
    const { deps, invites } = inviteWorld();
    const spy = spyStore(() => Promise.reject(new Error(`row for ${HOST}: receipt-123`)));
    const made = await create({ ...deps, entitlements: spy.store });
    expect(made).toEqual(refused("storageFailed"));
    expect(JSON.stringify(made)).not.toContain("receipt-123");
    expect(JSON.stringify(made)).not.toContain(HOST);
    expect(await invites.find("CODE0001")).toBeNull();
  });

  for (const [name, rows] of [
    ["an unknown platform", [{ platform: "xbox", source: "receipt-456" }]],
    ["an empty source", [{ platform: "web", source: "" }]],
    ["a matching row beside a bad one", [{ platform: "web", source: "store" }, { platform: "web" }]],
    ["not a list", { platform: "web", source: "receipt-456" }],
  ] as [string, unknown][]) {
    it(`a store returning a bad row (${name}) gives storageFailed with no row data, and stores nothing`, async () => {
      const { deps, invites } = inviteWorld();
      const spy = spyStore(() => Promise.resolve(rows as Entitlement[]));
      const made = await create({ ...deps, entitlements: spy.store });
      expect(made).toEqual(refused("storageFailed"));
      expect(JSON.stringify(made)).not.toContain("receipt-456");
      expect(JSON.stringify(made)).not.toContain("xbox");
      expect(await invites.find("CODE0001")).toBeNull();
    });
  }
});

describe("previewInvite and joinInvite never look at entitlements", () => {
  it("a joiner with no entitlement previews and joins as before, and the store is not called", async () => {
    const { deps, entitlements } = inviteWorld();
    const made = await create(deps, { sides: { mode: "host", hostSide: "lio" } });
    if (!made.ok) throw new Error(made.error.code);
    const { code } = made.value;
    expect(await entitlements.forPlayer(JOINER)).toEqual([]);
    const spy = spyStore(() => Promise.reject(new Error("entitlements must not be read")));
    const spied = { ...deps, entitlements: spy.store };
    expect(await previewInvite(spied, code)).toEqual({ ok: true, value: { sides: { mode: "host", hostSide: "lio" } } });
    const joined = await joinInvite(spied, { code, player: JOINER, now: INVITE_NOW + 1 });
    expect(joined).toMatchObject({ ok: true, value: { matchId: "match-1", side: "sae" } });
    expect(spy.asked).toEqual([]);
  });

  it("a join still works when the host has since lost every entitlement", async () => {
    const { deps, entitlements } = inviteWorld();
    const made = await create(deps);
    if (!made.ok) throw new Error(made.error.code);
    await entitlements.revokeAll(HOST);
    const joined = await joinInvite(deps, { code: made.value.code, player: JOINER, now: INVITE_NOW + 1 });
    expect(joined).toMatchObject({ ok: true, value: { matchId: "match-1" } });
  });
});
