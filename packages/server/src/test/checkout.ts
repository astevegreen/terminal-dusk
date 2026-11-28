// A fake Paddle for the checkout tests, answering as its "create transaction" endpoint does
// (https://developer.paddle.com/api-reference/transactions/create-transaction), cut to the fields the function
// reads plus a few it ignores. Every key, id and address is made up.
import type { CheckoutFetch, PaddleSettings } from "../paddleCheckout.ts";

export const PADDLE: PaddleSettings = {
  apiBase: "https://paddle.example.test",
  apiKey: "test-paddle-api-key",
  priceId: "pri_test_full_game",
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

/** A fake Paddle: it records every call and answers with `answer` (by default, a made transaction). */
export function fakePaddle(answer: () => Promise<Answer> = async () => created()) {
  const calls: PaddleCall[] = [];
  const signals: unknown[] = [];
  const fetch: CheckoutFetch = (url, { method, headers, body, signal }) => {
    calls.push({ url, method, headers, body: JSON.parse(body) });
    signals.push(signal);
    return answer();
  };
  return { fetch, calls, signals };
}
