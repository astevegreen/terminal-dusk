// Chargebacks and their reversals (#683, owner's decision: a chargeback removes the web copy and a reversed one
// gives it back), as signed Paddle messages over the in-memory entitlement store. Paddle has no refund reversal, so
// a refund stays final. paddleWebhook.stack.test.ts runs the same flow on the real tables.
import { describe, expect, it } from "vitest";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { handlePaddleWebhook } from "./paddleWebhookHandler.ts";
import { paid, PLAYER, PRODUCT, refund, SECRET, signed, TXN } from "./test/paddle.ts";

const COPY = { platform: "web", source: "paddle" };
const FIRST = "2026-11-28T10:00:00.000000Z";
const SECOND = "2026-11-28T10:00:00.001000Z";
const THIRD = "2026-11-29T10:00:00.000000Z";

type Change = Parameters<typeof refund>[0];
const chargeback = (change: Change = {}) => refund({ action: "chargeback", createdAt: FIRST, ...change });
const reversal = (change: Change = {}) => refund({ action: "chargeback_reverse", createdAt: SECOND, ...change });
const done = (outcome: string) => ({ status: 200, ok: true, outcome });

function setup() {
  const store = new MemoryEntitlementStore();
  const log: string[] = [];
  const deps = {
    secret: SECRET,
    productId: PRODUCT,
    receipts: store,
    playerExists: async (id: string) => id === PLAYER,
    log: (line: string) => log.push(line),
  };
  const send = async (body: string) => {
    const reply = await handlePaddleWebhook(deps, await signed(body));
    return { status: reply.status, ...(JSON.parse(reply.body) as { ok: boolean; outcome?: string }) };
  };
  /** A store in which the player has bought the game. */
  const bought = async () => void (await send(paid()));
  return { log, send, bought, owned: () => store.forPlayer(PLAYER) };
}

describe("an approved chargeback", () => {
  it.each(["adjustment.created", "adjustment.updated"] as const)("sent as %s removes the web copy", async (type) => {
    const t = setup();
    await t.bought();
    expect(await t.send(chargeback({ type }))).toEqual(done("revoked"));
    expect(await t.owned()).toEqual([]);
    expect(t.log).toContain(`paddle-webhook: chargeback of ${TXN} revoked`);
  });

  it("of every item, one by one, removes the copy", async () => {
    const t = setup();
    await t.bought();
    expect(await t.send(chargeback({ refundType: "partial" }))).toEqual(done("revoked"));
  });

  it("holds back a late payment message", async () => {
    const t = setup();
    await t.send(chargeback());
    expect(await t.send(paid())).toEqual(done("chargedBack"));
    expect(await t.owned()).toEqual([]);
  });
});

describe("a reversed chargeback", () => {
  it("gives the copy back", async () => {
    const t = setup();
    await t.bought();
    await t.send(chargeback());
    expect(await t.send(reversal({ type: "adjustment.updated" }))).toEqual(done("restored"));
    expect(await t.owned()).toEqual([COPY]);
    expect(t.log).toContain(`paddle-webhook: chargeback reversal of ${TXN} restored`);
  });

  it("gives the copy back whatever its refund type says", async () => {
    const t = setup();
    await t.bought();
    await t.send(chargeback());
    const partial = reversal({ refundType: "partial", items: [] });
    expect(await t.send(partial)).toEqual(done("restored"));
  });

  it("arriving first still leaves the buyer with the copy", async () => {
    const t = setup();
    await t.bought();
    expect(await t.send(reversal())).toEqual(done("remembered"));
    expect(await t.send(chargeback())).toEqual(done("remembered"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it("is not undone when the older chargeback is sent again", async () => {
    const t = setup();
    await t.bought();
    await t.send(chargeback());
    await t.send(reversal());
    expect(await t.send(chargeback())).toEqual(done("remembered"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it("does not stop a later chargeback", async () => {
    const t = setup();
    await t.bought();
    await t.send(chargeback());
    await t.send(reversal());
    expect(await t.send(chargeback({ createdAt: THIRD }))).toEqual(done("revoked"));
    expect(await t.owned()).toEqual([]);
  });

  it("gives the copy to a buyer whose payment message came during the chargeback", async () => {
    const t = setup();
    await t.send(chargeback());
    await t.send(paid());
    expect(await t.send(reversal())).toEqual(done("restored"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it("for a receipt that never paid gives nobody anything", async () => {
    const t = setup();
    expect(await t.send(reversal())).toEqual(done("remembered"));
    expect(await t.owned()).toEqual([]);
  });

  it("never gives back a refunded copy", async () => {
    const t = setup();
    await t.bought();
    await t.send(refund());
    await t.send(chargeback());
    expect(await t.send(reversal())).toEqual(done("remembered"));
    expect(await t.owned()).toEqual([]);
  });
});

describe("an adjustment that is not an approved chargeback or reversal", () => {
  it.each([
    ["a chargeback of part of the order", chargeback({ refundType: "partial", items: [{ type: "partial" }] })],
    ["an unapproved chargeback", chargeback({ status: "pending_approval" })],
    ["a rejected chargeback", chargeback({ status: "rejected" })],
    ["a chargeback marked reversed", chargeback({ status: "reversed" })],
    ["a chargeback warning", chargeback({ action: "chargeback_warning" })],
    ["a credit", chargeback({ action: "credit" })],
  ])("(%s) keeps the copy", async (_name, body) => {
    const t = setup();
    await t.bought();
    expect(await t.send(body)).toEqual(done("ignored"));
    expect(await t.owned()).toEqual([COPY]);
  });

  it.each([
    ["an unapproved reversal", reversal({ status: "pending_approval" })],
    ["a rejected reversal", reversal({ status: "rejected" })],
    ["a reversal marked reversed", reversal({ status: "reversed" })],
    ["a reversed chargeback warning", reversal({ action: "chargeback_warning_reverse" })],
    ["a reversed credit", reversal({ action: "credit_reverse" })],
  ])("(%s) does not give a charged-back copy back", async (_name, body) => {
    const t = setup();
    await t.bought();
    await t.send(chargeback());
    expect(await t.send(body)).toEqual(done("ignored"));
    expect(await t.owned()).toEqual([]);
  });
});

describe("a chargeback or reversal that can't be placed", () => {
  const UNREADABLE = [
    ["no time", null],
    ["an empty time", ""],
    ["words for a time", "yesterday"],
    ["a bare number", "1"],
    ["a number for a time", 1_700_000_000_000],
    ["a date that does not exist", "2026-13-40T10:00:00Z"],
    ["a time before 1970", "1969-12-31T23:59:59Z"],
  ] as const;

  it.each(UNREADABLE)("with %s is refused and changes nothing", async (_name, createdAt) => {
    const t = setup();
    await t.bought();
    expect((await t.send(chargeback({ createdAt }))).status).toBe(400);
    expect(await t.owned()).toEqual([COPY]);
    await t.send(chargeback());
    expect((await t.send(reversal({ createdAt }))).status).toBe(400);
    expect(await t.owned()).toEqual([]);
  });

  it.each([
    ["chargeback", chargeback({ transactionId: "" })],
    ["reversal", reversal({ transactionId: "" })],
  ])("(a %s with no transaction) is refused", async (_name, body) => {
    expect((await setup().send(body)).status).toBe(400);
  });

  it("is read with a time zone offset too", async () => {
    const t = setup();
    await t.bought();
    await t.send(chargeback({ createdAt: "2026-11-28T11:00:00+01:00" }));
    expect(await t.send(reversal())).toEqual(done("restored"));
  });

  it("is not needed by a refund, which stays final whenever it was made", async () => {
    const t = setup();
    await t.bought();
    expect(await t.send(refund({ createdAt: null }))).toEqual(done("revoked"));
  });
});
