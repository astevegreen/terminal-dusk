// Test messages shaped like Paddle Billing's webhooks (https://developer.paddle.com/webhooks), cut to the fields
// the function reads plus a few it ignores. Every id, the secret and the product are made up. Signing here uses
// the code under test; paddleSignature.test.ts checks that code against a value computed apart from it.
import { paddleSignature } from "../paddleSignature.ts";
import type { PaddleRequest } from "../paddleWebhookHandler.ts";

export const SECRET = "test-paddle-secret";
export const PRODUCT = "pro_test_full_game";
export const TXN = "txn_test_0001";
export const PLAYER = "00000000-0000-4000-8000-0000000000a1";
const TS = "1671552777";

type Paid = {
  type?: "transaction.paid" | "transaction.completed";
  id?: string;
  /** The order's custom data; `undefined` leaves the app's usual `player_id`. */
  customData?: unknown;
  product?: string;
};

/** A `transaction.paid` (or `completed`) message for one full-game copy. */
export function paid({ type = "transaction.paid", id = TXN, customData, product = PRODUCT }: Paid = {}): string {
  return JSON.stringify({
    event_id: `evt_test_${type}_${id}`,
    event_type: type,
    occurred_at: "2026-11-27T10:00:00.000000Z",
    notification_id: "ntf_test_0001",
    data: {
      id,
      status: type === "transaction.paid" ? "paid" : "completed",
      custom_data: customData === undefined ? { player_id: PLAYER } : customData,
      items: [{ quantity: 1, price: { id: "pri_test_0001", product_id: product } }],
    },
  });
}

type Refund = {
  type?: "adjustment.created" | "adjustment.updated";
  transactionId?: string;
  action?: string;
  status?: string;
  refundType?: string;
  items?: unknown;
  /** When Paddle made the adjustment; `null` for a message without a usable time. */
  createdAt?: unknown;
};

/** An `adjustment` message; by default an approved full refund of the transaction. */
export function refund({
  type = "adjustment.created",
  transactionId = TXN,
  action = "refund",
  status = "approved",
  refundType = "full",
  items = [{ item_id: "txnitm_test_0001", type: "full" }],
  createdAt = "2026-11-28T10:00:00.000000Z",
}: Refund = {}): string {
  return JSON.stringify({
    event_id: `evt_test_${type}_${transactionId}`,
    event_type: type,
    occurred_at: "2026-11-28T10:00:00.000000Z",
    notification_id: "ntf_test_0002",
    data: {
      id: "adj_test_0001",
      action,
      type: refundType,
      status,
      transaction_id: transactionId,
      items,
      created_at: createdAt,
    },
  });
}

/** The POST Paddle would send for `body`, signed with `secret`. */
export async function signed(body: string, secret: string = SECRET): Promise<PaddleRequest> {
  return { method: "POST", body, signature: `ts=${TS};h1=${await paddleSignature(secret, TS, body)}` };
}
