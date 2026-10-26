// O9c through the invite handler: "create" must name the platform the app is on (a string), a free player gets
// 403 notEntitled with the host's plain-English message, and preview and join never look at entitlements.
import { createOnlineRefusal } from "@terminal-dusk/host";
import type { Entitlement } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import type { EntitlementStore } from "./entitlementStore.ts";
import type { HttpReply } from "./http.ts";
import { handleInvite } from "./inviteHandler.ts";
import { post } from "./test/handler.ts";
import { body, inviteHandlerWorld } from "./test/inviteHandler.ts";
import { HOST, JOINER } from "./test/invites.ts";

function expectRefused(reply: HttpReply, status: number, code: string): void {
  expect(reply.status).toBe(status);
  expect(body(reply)).toEqual({ ok: false, error: { code, message: expect.any(String) } });
}

/** An entitlement store that counts its calls and answers with `answer`. */
function spyStore(answer: () => Promise<Entitlement[]>): { store: EntitlementStore; calls: () => number } {
  let calls = 0;
  return {
    store: {
      forPlayer() {
        calls++;
        return answer();
      },
    },
    calls: () => calls,
  };
}

describe("invite handler: a free player cannot create a private game", () => {
  it("a free creator gets 403 notEntitled with the host's message, and no invite is stored", async () => {
    const w = inviteHandlerWorld();
    const reply = await handleInvite(
      w.deps,
      post("token-joiner", { action: "create", sides: { mode: "random" }, platform: "web" }),
    );
    expect(reply.status).toBe(403);
    const message = createOnlineRefusal([], "web")?.message;
    expect(body(reply)).toEqual({ ok: false, error: { code: "notEntitled", message } });
    expect(w.storeCalls()).toBe(0);
    expect(await w.world.invites.find("CODE0001")).toBeNull();
  });

  it("an entitlement for another platform gets 403; one for the stated platform creates the invite", async () => {
    const w = inviteHandlerWorld();
    await w.world.entitlements.grant(JOINER, { platform: "android", source: "test" });
    const send = (platform: string) =>
      handleInvite(w.deps, post("token-joiner", { action: "create", sides: { mode: "invitee" }, platform }));
    expectRefused(await send("steam"), 403, "notEntitled");
    const reply = await send("android");
    expect(reply.status).toBe(200);
    expect(body(reply)).toEqual({ ok: true, code: "CODE0001" });
    expect(await w.world.invites.find("CODE0001")).toMatchObject({ host: JOINER });
  });

  const notStrings: [string, Record<string, unknown>][] = [
    ["no platform", {}],
    ["a number", { platform: 1 }],
    ["null", { platform: null }],
    ["a list", { platform: ["web"] }],
    ["an object", { platform: { name: "web" } }],
  ];
  for (const [name, extra] of notStrings) {
    it(`create with ${name} as the platform gets 400 illegalAnswer, before any lookup`, async () => {
      const w = inviteHandlerWorld();
      const spy = spyStore(() => Promise.resolve([]));
      const deps = { ...w.deps, entitlements: spy.store };
      const reply = await handleInvite(
        deps,
        post("token-host", { action: "create", sides: { mode: "random" }, ...extra }),
      );
      expectRefused(reply, 400, "illegalAnswer");
      expect(spy.calls()).toBe(0);
      expect(w.storeCalls()).toBe(0);
    });
  }

  it("create with an unknown platform string gets 422 invalidInvite naming the four platforms, before any lookup", async () => {
    const w = inviteHandlerWorld();
    const spy = spyStore(() => Promise.resolve([]));
    const deps = { ...w.deps, entitlements: spy.store };
    const reply = await handleInvite(
      deps,
      post("token-host", { action: "create", sides: { mode: "random" }, platform: "xbox" }),
    );
    expectRefused(reply, 422, "invalidInvite");
    for (const known of ["web", "steam", "ios", "android"]) expect(reply.body).toContain(known);
    expect(spy.calls()).toBe(0);
    expect(w.storeCalls()).toBe(0);
  });

  it("a throwing store or a store returning a bad row gives 500 storageFailed with no row data", async () => {
    for (const answer of [
      () => Promise.reject(new Error(`receipt-789 for ${HOST}`)),
      () => Promise.resolve([{ platform: "xbox", source: "receipt-789" }] as unknown as Entitlement[]),
    ]) {
      const w = inviteHandlerWorld();
      const deps = { ...w.deps, entitlements: spyStore(answer).store };
      const reply = await handleInvite(
        deps,
        post("token-host", { action: "create", sides: { mode: "random" }, platform: "web" }),
      );
      expectRefused(reply, 500, "storageFailed");
      expect(reply.body).not.toContain("receipt-789");
      expect(reply.body).not.toContain("xbox");
      expect(reply.body).not.toContain(HOST);
      expect(w.storeCalls()).toBe(0);
    }
  });
});

describe("invite handler: preview and join never look at entitlements", () => {
  it("a joiner with no entitlement previews and joins, and the entitlement store is not called", async () => {
    const w = inviteHandlerWorld();
    const create = await handleInvite(
      w.deps,
      post("token-host", { action: "create", sides: { mode: "invitee" }, platform: "web" }),
    );
    const { code } = body(create) as { code: string };
    const spy = spyStore(() => Promise.reject(new Error("entitlements must not be read")));
    const deps = { ...w.deps, entitlements: spy.store };
    const preview = await handleInvite(deps, post("token-joiner", { action: "preview", code }));
    expect(body(preview)).toEqual({ ok: true, sides: { mode: "invitee" } });
    const join = await handleInvite(deps, post("token-joiner", { action: "join", code, side: "lio" }));
    expect(join.status).toBe(200);
    expect(body(join)).toEqual({ ok: true, matchId: "match-1", side: "lio" });
    expect(spy.calls()).toBe(0);
  });
});
