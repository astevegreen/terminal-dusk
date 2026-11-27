// The Paddle webhook (#683) on the local Supabase stack: the real tables, written with the service role, and the
// real account check. paddleWebhookEdge.stack.test.ts calls the served function.
// Without a running local stack, one test says so and how to start it.
import { expect, it } from "vitest";
import { freshId } from "./migrations/localStack.ts";
import { supabasePlayerExists } from "./paddleWebhookEdge.ts";
import { handlePaddleWebhook } from "./paddleWebhookHandler.ts";
import type { PaddleRequest } from "./paddleWebhookHandler.ts";
import { SupabaseEntitlementStore } from "./supabaseEntitlementStore.ts";
import { entitlementStack } from "./test/entitlementStack.ts";
import { paid, PRODUCT, refund, SECRET, signed } from "./test/paddle.ts";
import { receiptRows } from "./test/receiptRows.ts";
import { onLocalStack } from "./test/stack.ts";

const TIMEOUT = 60_000;
const COPY = { platform: "web", source: "paddle" };

await onLocalStack("the Paddle webhook on the local Supabase stack", (keys) => {
  const stack = entitlementStack(keys);
  const receipts = receiptRows(() => stack.service);
  const store = () => new SupabaseEntitlementStore(stack.service);
  const send = async (request: PaddleRequest) => {
    const reply = await handlePaddleWebhook(
      {
        secret: SECRET,
        productId: PRODUCT,
        receipts: store(),
        playerExists: supabasePlayerExists(stack.service),
        log: () => {},
      },
      request,
    );
    return [reply.status, (JSON.parse(reply.body) as { outcome?: string }).outcome];
  };
  const rows = async (ref: string) =>
    (await stack.service.from("entitlement").select("player, platform, source").eq("receipt_ref", ref)).data;

  it(
    "a signed paid message adds one web row once, and its refund removes it for good",
    async () => {
      const id = receipts.fresh();
      const buy = await signed(paid({ id, customData: { player_id: stack.owner.id } }));
      expect(await send(buy)).toEqual([200, "granted"]);
      expect(await send(buy)).toEqual([200, "already"]);
      expect(await rows(id)).toEqual([{ player: stack.owner.id, ...COPY }]);

      expect(await send(await signed(refund({ transactionId: id })))).toEqual([200, "revoked"]);
      expect(await send(buy)).toEqual([200, "refunded"]);
      expect(await rows(id)).toEqual([]);
    },
    TIMEOUT,
  );

  it(
    "a chargeback removes the web row, and its reversal gives it back once",
    async () => {
      const id = receipts.fresh();
      const buy = await signed(paid({ id, customData: { player_id: stack.owner.id } }));
      const dispute = (action: string, createdAt: string) => signed(refund({ transactionId: id, action, createdAt }));
      const chargeback = await dispute("chargeback", "2026-11-28T10:00:00.000000Z");
      const reversal = await dispute("chargeback_reverse", "2026-11-29T10:00:00.000000Z");
      await send(buy);
      expect(await send(chargeback)).toEqual([200, "revoked"]);
      expect(await send(buy)).toEqual([200, "chargedBack"]);
      expect(await rows(id)).toEqual([]);

      expect(await send(reversal)).toEqual([200, "restored"]);
      expect(await send(reversal)).toEqual([200, "remembered"]);
      expect(await send(chargeback)).toEqual([200, "remembered"]);
      expect(await rows(id)).toEqual([{ player: stack.owner.id, ...COPY }]);
    },
    TIMEOUT,
  );

  it(
    "a player id no account has is recorded and gets no row",
    async () => {
      const id = receipts.fresh();
      const buy = await signed(paid({ id, customData: { player_id: freshId() } }));
      expect(await send(buy)).toEqual([200, "unmatched"]);
      expect(await rows(id)).toEqual([]);
      expect(await receipts.unmatched("paddle", id)).toEqual(["unknownPlayer"]);
    },
    TIMEOUT,
  );

  it(
    "a wrong signature writes nothing",
    async () => {
      const id = receipts.fresh();
      const buy = await signed(paid({ id, customData: { player_id: stack.owner.id } }), "another-secret");
      expect((await send(buy))[0]).toBe(401);
      expect(await rows(id)).toEqual([]);
    },
    TIMEOUT,
  );
});
