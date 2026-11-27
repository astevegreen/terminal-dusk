// The Paddle webhook's behaviour (#683) with plain data in and out, over the in-memory entitlement store. Each test
// is named after what the issue asks. paddleWebhook.stack.test.ts runs the same flow on the real tables.
import { describe, expect, it } from "vitest";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { handlePaddleWebhook } from "./paddleWebhookHandler.ts";
import type { PaddleWebhookDeps } from "./paddleWebhookHandler.ts";
import { paid, PLAYER, PRODUCT, refund, SECRET, signed, TXN } from "./test/paddle.ts";

const COPY = { platform: "web", source: "paddle" };
const STRANGER = "00000000-0000-4000-8000-0000000000ff";

function setup(change: Partial<PaddleWebhookDeps> = {}) {
  const store = new MemoryEntitlementStore();
  const log: string[] = [];
  const asked: string[] = [];
  const deps: PaddleWebhookDeps = {
    secret: SECRET,
    productId: PRODUCT,
    receipts: store,
    playerExists: async (id) => (asked.push(id), id === PLAYER),
    log: (line) => log.push(line),
    ...change,
  };
  const send = async (body: string) => answer(await handlePaddleWebhook(deps, await signed(body)));
  return { deps, store, log, asked, send, owned: () => store.forPlayer(PLAYER) };
}

const answer = (reply: { status: number; body: string }) => ({
  status: reply.status,
  ...(JSON.parse(reply.body) as { ok: boolean; outcome: string }),
});
const done = (outcome: string) => ({ status: 200, ok: true, outcome });

describe("a paid message", () => {
  it("with a valid signature adds one web entitlement under the transaction's id", async () => {
    const t = setup();
    expect(await t.send(paid())).toEqual(done("granted"));
    expect(await t.owned()).toEqual([COPY]);
    expect(await t.store.revokeReceipt("paddle", TXN)).toBe("revoked");
  });

  it("sent twice adds one row", async () => {
    const t = setup();
    await t.send(paid());
    expect(await t.send(paid())).toEqual(done("already"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it("sent as paid and then completed adds one row", async () => {
    const t = setup();
    await t.send(paid());
    expect(await t.send(paid({ type: "transaction.completed" }))).toEqual(done("already"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it("sent only as completed still adds the row", async () => {
    const t = setup();
    expect(await t.send(paid({ type: "transaction.completed" }))).toEqual(done("granted"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it("for some other product is ignored and not recorded", async () => {
    const t = setup();
    expect(await t.send(paid({ product: "pro_test_something_else" }))).toEqual(done("ignored"));
    expect(await t.owned()).toEqual([]);
    expect(t.store.unmatchedFor("paddle", TXN)).toEqual([]);
  });

  it("answers 500 and writes nothing while no product is configured, so Paddle sends it again", async () => {
    const t = setup({ productId: undefined });
    expect((await t.send(paid())).status).toBe(500);
    expect(await t.owned()).toEqual([]);
    expect(t.store.unmatchedFor("paddle", TXN)).toEqual([]);
  });
});

describe("a message without a known player id is recorded and ignored, never guessed", () => {
  it.each([
    ["no custom data", null, "noPlayerId"],
    ["empty custom data", {}, "noPlayerId"],
    ["custom data that is not an object", "player", "noPlayerId"],
    ["an empty player id", { player_id: "" }, "noPlayerId"],
    ["a player id that is not text", { player_id: 7 }, "badPlayerId"],
    ["a player id that is not a UUID", { player_id: "alice@example.test" }, "badPlayerId"],
    ["another key's player id", { playerId: PLAYER }, "noPlayerId"],
    ["an id no account has", { player_id: STRANGER }, "unknownPlayer"],
  ] as const)("with %s", async (_name, customData, reason) => {
    const t = setup();
    expect(await t.send(paid({ customData }))).toEqual(done("unmatched"));
    expect(await t.owned()).toEqual([]);
    expect(await t.store.forPlayer(STRANGER)).toEqual([]);
    expect(t.store.unmatchedFor("paddle", TXN)).toEqual([reason]);
    expect(t.log).toEqual([`paddle-webhook: unmatched purchase ${TXN} (${reason})`]);
  });

  it("asks about a player only when the id could be one", async () => {
    const t = setup();
    await t.send(paid({ customData: { player_id: "not-a-uuid" } }));
    expect(t.asked).toEqual([]);
    await t.send(paid({ customData: { player_id: STRANGER } }));
    expect(t.asked).toEqual([STRANGER]);
  });

  it("answers 500 and records nothing when the player lookup fails", async () => {
    const t = setup({ playerExists: () => Promise.reject(new Error("auth is down")) });
    expect((await t.send(paid())).status).toBe(500);
    expect(await t.owned()).toEqual([]);
    expect(t.store.unmatchedFor("paddle", TXN)).toEqual([]);
  });
});

describe("a missing or wrong signature adds nothing and answers 401", () => {
  it.each([
    ["no signature", { signature: null }],
    ["a signature for another body", { body: paid({ id: "txn_test_other" }) }],
    ["a made-up signature", { signature: `ts=1671552777;h1=${"a".repeat(64)}` }],
  ] as const)("with %s", async (_name, change) => {
    const t = setup();
    const reply = await handlePaddleWebhook(t.deps, { ...(await signed(paid())), ...change });
    expect(reply.status).toBe(401);
    expect(await t.owned()).toEqual([]);
    expect(t.asked).toEqual([]);
  });

  it("with another secret", async () => {
    const t = setup();
    const reply = await handlePaddleWebhook(t.deps, await signed(paid(), "another-secret"));
    expect(reply.status).toBe(401);
    expect(await t.owned()).toEqual([]);
  });

  it.each([undefined, ""])("while the webhook secret is %j", async (secret) => {
    const t = setup({ secret });
    expect((await t.send(paid())).status).toBe(401);
    expect(await t.owned()).toEqual([]);
  });

  it("and leaves an owned copy in place when the refund is unsigned", async () => {
    const t = setup();
    await t.send(paid());
    const reply = await handlePaddleWebhook(t.deps, { method: "POST", body: refund(), signature: null });
    expect(reply.status).toBe(401);
    expect(await t.owned()).toEqual([COPY]);
  });
});

describe("a refund", () => {
  it.each(["adjustment.created", "adjustment.updated"] as const)("approved (%s) removes that row", async (type) => {
    const t = setup();
    await t.send(paid());
    await t.send(paid({ id: "txn_test_kept" }));
    expect(await t.send(refund({ type }))).toEqual(done("revoked"));
    expect(await t.owned()).toEqual([COPY]);
    expect(await t.store.revokeReceipt("paddle", "txn_test_kept")).toBe("revoked");
  });

  it("of every item in full removes the row, though Paddle marks the adjustment partial", async () => {
    const t = setup();
    await t.send(paid());
    expect(await t.send(refund({ refundType: "partial" }))).toEqual(done("revoked"));
    expect(await t.owned()).toEqual([]);
  });

  it("works while no product is configured", async () => {
    const t = setup();
    await t.send(paid());
    t.deps.productId = undefined;
    expect(await t.send(refund())).toEqual(done("revoked"));
  });

  it.each([
    ["waiting for approval", { status: "pending_approval" }],
    ["rejected", { status: "rejected" }],
    ["reversed", { status: "reversed" }],
    ["of part of the amount", { refundType: "partial", items: [{ type: "partial" }] }],
    ["of the tax", { refundType: "partial", items: [{ type: "tax" }] }],
    [
      "of one item in full and another in part",
      { refundType: "partial", items: [{ type: "full" }, { type: "partial" }] },
    ],
    ["partial with no items", { refundType: "partial", items: [] }],
    ["really a credit", { action: "credit" }],
  ])("that is %s keeps the entitlement", async (_name, change) => {
    const t = setup();
    await t.send(paid());
    expect(await t.send(refund(change))).toEqual(done("ignored"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it("for a receipt that never paid does nothing", async () => {
    const t = setup();
    await t.send(paid());
    expect(await t.send(refund({ transactionId: "txn_test_never_paid" }))).toEqual(done("remembered"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it("is not undone by a paid message delivered late", async () => {
    const t = setup();
    await t.send(paid());
    await t.send(refund());
    expect(await t.send(paid({ type: "transaction.completed" }))).toEqual(done("refunded"));
    expect(await t.owned()).toEqual([]);
  });

  it("that arrives before its paid message still wins", async () => {
    const t = setup();
    await t.send(refund());
    expect(await t.send(paid())).toEqual(done("refunded"));
    expect(await t.owned()).toEqual([]);
  });
});

describe("other requests", () => {
  it.each(["GET", "OPTIONS", "PUT"])("a %s answers 405", async (method) => {
    const t = setup();
    const reply = await handlePaddleWebhook(t.deps, { ...(await signed(paid())), method });
    expect(reply.status).toBe(405);
    expect(await t.owned()).toEqual([]);
  });

  it("an event type the function does not use is answered 200 and ignored", async () => {
    const t = setup();
    expect(await t.send(JSON.stringify({ event_type: "customer.created", data: { id: "ctm_test" } }))).toEqual(
      done("ignored"),
    );
  });

  it.each([
    ["not JSON", "paid, honestly"],
    ["no event type", JSON.stringify({ data: {} })],
    ["a paid message with no data", JSON.stringify({ event_type: "transaction.paid" })],
    ["a paid message with no transaction id", JSON.stringify({ event_type: "transaction.paid", data: { items: [] } })],
    [
      "an approved full refund naming no transaction",
      JSON.stringify({
        event_type: "adjustment.created",
        data: { action: "refund", status: "approved", type: "full" },
      }),
    ],
  ])("a signed body that is %s answers 400", async (_name, body) => {
    const t = setup();
    expect((await t.send(body)).status).toBe(400);
  });

  it("answers 500 when the store fails, so Paddle sends the message again", async () => {
    const store = new MemoryEntitlementStore();
    store.grantReceipt = () => Promise.reject(new Error("database down"));
    const t = setup({ receipts: store });
    expect((await t.send(paid())).status).toBe(500);
  });

  it("puts no secret, signature, player id or message body in a reply or a log line", async () => {
    const t = setup();
    const bodies = [paid(), paid(), refund(), paid({ id: "txn_test_2", customData: { player_id: STRANGER } })];
    const seen: string[] = [];
    for (const body of bodies) {
      const request = await signed(body);
      seen.push((await handlePaddleWebhook(t.deps, request)).body);
      seen.push((await handlePaddleWebhook(t.deps, { ...request, body: `${body} ` })).body);
    }
    const text = [...seen, ...t.log].join("\n");
    for (const hidden of [SECRET, PLAYER, STRANGER, "h1=", "custom_data"]) expect(text).not.toContain(hidden);
  });
});
