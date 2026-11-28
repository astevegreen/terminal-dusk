// A fake Paddle for the checkout tests, answering as its "create transaction" endpoint does
// (https://developer.paddle.com/api-reference/transactions/create-transaction), cut to the fields the function
// reads plus a few it ignores. Every key, id and address is made up.
import type { CheckoutFetch, PaddleSettings } from "../paddleCheckout.ts";

export const PADDLE: PaddleSettings = {
  apiBase: "https://paddle.example.test",
  apiKey: "test-paddle-api-key",
  priceId: "pri_test_full_game",
  productId: "pro_test_full_game",
  appUrl: "https://play.example.test",
};
export const TXN_ID = "txn_test0001";
export const PAY_URL = `https://play.example.test/pay/?_ptxn=${TXN_ID}`;

export type PaddleCall = { url: string; method: string; headers: Record<string, string>; body: unknown };

type Answer = { status: number; json: () => Promise<unknown> };

export const answers = (status: number, body: unknown): Answer => ({ status, json: async () => body });

/** The answer to a transaction that was made. */
export const created = (url: unknown = PAY_URL): Answer =>
  answers(201, { data: { id: TXN_ID, status: "draft", checkout: { url } }, meta: { request_id: "req_test" } });

/** The answer to a price read: the price belongs to `product`. */
export const price = (product: unknown = PADDLE.productId): Answer =>
  answers(200, {
    data: { id: PADDLE.priceId, product_id: product, status: "active" },
    meta: { request_id: "req_test" },
  });

/**
 * A fake Paddle: it records every transaction request in `calls` and answers it with `answer` (by default, a made
 * transaction). The price read (GET /prices/<id>) is kept apart in `priceCalls` and answered with `priceAnswer`
 * (by default, a price of the full game's product).
 */
export function fakePaddle(
  answer: () => Promise<Answer> = async () => created(),
  priceAnswer: () => Promise<Answer> = async () => price(),
) {
  const calls: PaddleCall[] = [];
  const priceCalls: { url: string; headers: Record<string, string> }[] = [];
  const signals: unknown[] = [];
  const fetch: CheckoutFetch = (url, { method, headers, body, signal }) => {
    if (method === "GET") {
      priceCalls.push({ url, headers });
      return priceAnswer();
    }
    calls.push({ url, method, headers, body: JSON.parse(body ?? "null") });
    signals.push(signal);
    return answer();
  };
  return { fetch, calls, priceCalls, signals };
}
