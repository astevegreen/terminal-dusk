import { describe, expect, it } from "vitest";
import type { FetchRequest } from "./edge.ts";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { hashGiftCode, normalizeGiftCode } from "./giftCode.ts";
import { MemoryGiftCodeStore } from "./giftCodeStore.ts";
import { redeemFetchHandler } from "./redeemEdge.ts";
import type { RedeemHandlerDeps } from "./redeemHandler.ts";

type Made = { body: string | null; init: { status: number; headers: Record<string, string> } };
const make = (body: string | null, init: Made["init"]): Made => ({ body, init });
const CODE = "ABCDE-FGHJK-MNPQR-STUVW";

const request = (method: string, headers: Record<string, string>, text: () => Promise<string>): FetchRequest => ({
  method,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  text,
});

async function world() {
  const entitlements = new MemoryEntitlementStore();
  const codes = new MemoryGiftCodeStore(entitlements, [
    { hash: await hashGiftCode(normalizeGiftCode(CODE)!), platform: "web" },
  ]);
  const deps: RedeemHandlerDeps = {
    authenticate: async (token) => (token === "token-alice" ? "alice" : null),
    codes,
    now: () => 5,
  };
  return { deps, entitlements };
}

describe("redeem Edge Function glue: fetch requests to handleRedeem and back", () => {
  it("passes the method, the Authorization header and the body: a good code gives alice the web copy", async () => {
    const w = await world();
    const made = await redeemFetchHandler(
      w.deps,
      make,
    )(request("POST", { authorization: "Bearer token-alice" }, async () => JSON.stringify({ code: CODE })));
    expect(made.init.status).toBe(200);
    expect(made.init.headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(JSON.parse(made.body!)).toMatchObject({ ok: true, status: "redeemed" });
    expect(await w.entitlements.forPlayer("alice")).toEqual([{ platform: "web", source: "gift code" }]);
  });

  it("OPTIONS makes a response with a null body, as a 204 requires", async () => {
    const w = await world();
    const made = await redeemFetchHandler(w.deps, make)(request("OPTIONS", {}, async () => ""));
    expect(made).toEqual({ body: null, init: { status: 204, headers: expect.any(Object) } });
  });

  it("a body that cannot be read counts as empty: 400, nothing granted", async () => {
    const w = await world();
    const made = await redeemFetchHandler(
      w.deps,
      make,
    )(request("POST", { authorization: "Bearer token-alice" }, () => Promise.reject(new Error("stream broke"))));
    expect(made.init.status).toBe(400);
    expect(await w.entitlements.forPlayer("alice")).toEqual([]);
  });
});
