import { describe, expect, it } from "vitest";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { hashGiftCode, normalizeGiftCode } from "./giftCode.ts";
import { MemoryGiftCodeStore, WRONG_GUESS_LIMIT } from "./giftCodeStore.ts";
import type { GiftCodeStore } from "./giftCodeStore.ts";
import { preflight } from "./http.ts";
import type { HttpRequest } from "./http.ts";
import { handleRedeem } from "./redeemHandler.ts";
import type { RedeemHandlerDeps } from "./redeemHandler.ts";

const NOW = 1_700_000_000_000;
const CODE = "ABCDE-FGHJK-MNPQR-STUVW";
const OTHER = "ABCDE-FGHJK-MNPQR-STUVX";
const TOKENS: Record<string, string> = { "token-alice": "alice", "token-bob": "bob" };

const post = (token: string | null, body: unknown): HttpRequest => ({
  method: "POST",
  authorization: token === null ? null : `Bearer ${token}`,
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const json = (reply: { body: string }): { ok: boolean; status?: string; error?: { code: string; message: string } } =>
  JSON.parse(reply.body);

async function world(change: Partial<RedeemHandlerDeps> = {}) {
  const entitlements = new MemoryEntitlementStore();
  const codes = new MemoryGiftCodeStore(entitlements, [
    { hash: await hashGiftCode(normalizeGiftCode(CODE)!), platform: "web" },
  ]);
  const redeemCalls: string[] = [];
  const store: GiftCodeStore = {
    redeem(hash, player, now) {
      redeemCalls.push(`${hash} ${player} ${now}`);
      return codes.redeem(hash, player, now);
    },
  };
  const logs: string[] = [];
  const deps: RedeemHandlerDeps = {
    authenticate: async (token) => TOKENS[token] ?? null,
    codes: store,
    now: () => NOW,
    log: (line) => logs.push(line),
    ...change,
  };
  return { deps, entitlements, redeemCalls, logs };
}

describe("handleRedeem: a signed-in player turns a gift code into a copy of the game", () => {
  it("answers OPTIONS with the shared preflight and touches no store", async () => {
    const w = await world();
    expect(await handleRedeem(w.deps, { method: "OPTIONS", authorization: null, body: "" })).toEqual(preflight());
    expect(w.redeemCalls).toEqual([]);
  });

  it("a good code adds one entitlement with source 'gift code' for the code's platform, and says so", async () => {
    const w = await world();
    const reply = await handleRedeem(w.deps, post("token-alice", { code: CODE }));
    expect(reply.status).toBe(200);
    expect(json(reply)).toEqual({ ok: true, status: "redeemed", message: expect.stringMatching(/yours/i) });
    expect(await w.entitlements.forPlayer("alice")).toEqual([{ platform: "web", source: "gift code" }]);
  });

  it("accepts the code however it is typed: lower case, spaces, no dashes", async () => {
    const w = await world();
    const reply = await handleRedeem(w.deps, post("token-alice", { code: " abcde fghjk mnpqrstuvw " }));
    expect(json(reply).status).toBe("redeemed");
  });

  it("passes only the code's hash to the store, never the code, with the caller and the clock", async () => {
    const w = await world();
    await handleRedeem(w.deps, post("token-alice", { code: CODE }));
    expect(w.redeemCalls).toEqual([`${await hashGiftCode(normalizeGiftCode(CODE)!)} alice ${NOW}`]);
  });

  it("the same code twice grants once; the second answer says it is already theirs", async () => {
    const w = await world();
    await handleRedeem(w.deps, post("token-alice", { code: CODE }));
    const again = await handleRedeem(w.deps, post("token-alice", { code: CODE }));
    expect(again.status).toBe(200);
    expect(json(again)).toEqual({ ok: true, status: "alreadyYours", message: expect.stringMatching(/already/i) });
    expect(await w.entitlements.forPlayer("alice")).toHaveLength(1);
  });

  it("two callers racing for one code: one is granted, the other refused with words", async () => {
    const w = await world();
    const replies = await Promise.all([
      handleRedeem(w.deps, post("token-alice", { code: CODE })),
      handleRedeem(w.deps, post("token-bob", { code: CODE })),
    ]);
    expect(replies.map((r) => r.status).toSorted()).toEqual([200, 409]);
    const refused = replies.find((r) => r.status === 409)!;
    expect(json(refused).error).toEqual({ code: "codeUsed", message: expect.stringMatching(/already been used/i) });
    const granted = [...(await w.entitlements.forPlayer("alice")), ...(await w.entitlements.forPlayer("bob"))];
    expect(granted).toHaveLength(1);
  });

  it("an unknown code is refused with 404 and words, and grants nothing", async () => {
    const w = await world();
    const reply = await handleRedeem(w.deps, post("token-alice", { code: OTHER }));
    expect(reply.status).toBe(404);
    expect(json(reply)).toEqual({
      ok: false,
      error: { code: "unknownCode", message: expect.stringMatching(/no such code|check/i) },
    });
    expect(await w.entitlements.forPlayer("alice")).toEqual([]);
  });

  it("a signed-out caller is refused with 401 and words, and the store is never called", async () => {
    for (const token of [null, "token-nobody"]) {
      const w = await world();
      const reply = await handleRedeem(w.deps, post(token, { code: CODE }));
      expect(reply.status).toBe(401);
      expect(json(reply).error).toEqual({ code: "notSignedIn", message: expect.stringMatching(/sign in/i) });
      expect(w.redeemCalls).toEqual([]);
    }
  });

  it("a caller who already owns the platform is refused with 409, and the code stays unused", async () => {
    const w = await world();
    await w.entitlements.grant("alice", { platform: "web", source: "checkout" });
    const reply = await handleRedeem(w.deps, post("token-alice", { code: CODE }));
    expect(reply.status).toBe(409);
    expect(json(reply).error).toEqual({ code: "alreadyOwned", message: expect.stringMatching(/pass it on/i) });
    expect(json(await handleRedeem(w.deps, post("token-bob", { code: CODE }))).status).toBe("redeemed");
  });

  it("repeated wrong guesses by one caller are refused with 429 and words, even for a good code", async () => {
    const w = await world();
    for (let i = 0; i < WRONG_GUESS_LIMIT; i++) {
      expect((await handleRedeem(w.deps, post("token-alice", { code: OTHER }))).status).toBe(404);
    }
    const reply = await handleRedeem(w.deps, post("token-alice", { code: CODE }));
    expect(reply.status).toBe(429);
    expect(json(reply).error).toEqual({ code: "tooManyGuesses", message: expect.stringMatching(/hour/i) });
    expect(await w.entitlements.forPlayer("alice")).toEqual([]);
  });

  it.each([
    ["not JSON", "{"],
    ["no code", {}],
    ["a code that is not text", { code: 12 }],
    ["a code of the wrong length", { code: "ABCDE" }],
    ["a code with look-alike characters", { code: "ABCDE-FGHJK-MNPQR-STUVO" }],
  ])("refuses a body with %s with 400 before calling the store", async (_name, body) => {
    const w = await world();
    const reply = await handleRedeem(w.deps, post("token-alice", body));
    expect(reply.status).toBe(400);
    expect(json(reply).error?.code).toBe("illegalAnswer");
    expect(w.redeemCalls).toEqual([]);
  });

  it("refuses other methods with 405", async () => {
    const w = await world();
    const reply = await handleRedeem(w.deps, { method: "GET", authorization: null, body: "" });
    expect(reply.status).toBe(405);
    expect(json(reply).error?.code).toBe("methodNotAllowed");
  });

  it("a store failure answers 500 storageFailed, with none of its text", async () => {
    const w = await world({
      codes: { redeem: () => Promise.reject(new Error("db down key=secret-key")) },
    });
    const reply = await handleRedeem(w.deps, post("token-alice", { code: CODE }));
    expect(reply.status).toBe(500);
    expect(json(reply).error?.code).toBe("storageFailed");
    expect(reply.body).not.toContain("secret-key");
  });

  it("logs only the outcome: never the code, its hash, the token or the player", async () => {
    const w = await world();
    await handleRedeem(w.deps, post("token-alice", { code: CODE }));
    await handleRedeem(w.deps, post("token-bob", { code: OTHER }));
    await handleRedeem(w.deps, post(null, { code: CODE }));
    expect(w.logs).toEqual(["redeem outcome=redeemed", "redeem error=unknownCode", "redeem error=notSignedIn"]);
    const hash = await hashGiftCode(normalizeGiftCode(CODE)!);
    for (const secret of [CODE, normalizeGiftCode(CODE)!, hash, "token-alice", "alice", "bob"]) {
      expect(w.logs.join("\n")).not.toContain(secret);
    }
  });

  it("never throws: a logger that throws still gets the reply", async () => {
    const w = await world({
      log: () => {
        throw new Error("log down");
      },
    });
    expect((await handleRedeem(w.deps, post("token-alice", { code: CODE }))).status).toBe(200);
  });
});
