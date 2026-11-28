import { afterEach, describe, expect, it, vi } from "vitest";
import { PADDLE_TIMEOUT_MS, paddleCheckout } from "./paddleCheckout.ts";
import type { CheckoutFetch } from "./paddleCheckout.ts";
import { created, fakePaddle, PADDLE, PAY_URL } from "./test/checkout.ts";

const aborted = (signal: unknown): boolean => (signal as { aborted: boolean }).aborted;
const never = () => new Promise<never>(() => {});

describe("paddleCheckout: how long it waits for Paddle", () => {
  afterEach(() => vi.useRealTimers());

  it("waits ten seconds, then gives up and cancels the request", async () => {
    vi.useFakeTimers();
    const paddle = fakePaddle(never);
    let done: unknown;
    void paddleCheckout(PADDLE, paddle.fetch)("player-alice").then((address) => (done = address));
    await vi.advanceTimersByTimeAsync(PADDLE_TIMEOUT_MS - 1);
    expect([done, aborted(paddle.signals[0])]).toEqual([undefined, false]);
    await vi.advanceTimersByTimeAsync(1);
    expect([done, aborted(paddle.signals[0])]).toEqual([{ ok: false, reason: "timedOut" }, true]);
    expect(PADDLE_TIMEOUT_MS).toBe(10_000);
  });

  it("also gives up when the reply starts but its body never arrives", async () => {
    vi.useFakeTimers();
    const paddle = fakePaddle(async () => ({ status: 201, json: never }));
    const asked = paddleCheckout(PADDLE, paddle.fetch)("player-alice");
    await vi.advanceTimersByTimeAsync(PADDLE_TIMEOUT_MS);
    expect(await asked).toEqual({ ok: false, reason: "timedOut" });
  });

  it("says timedOut when the cancelled request fails first, as a real fetch does", async () => {
    vi.useFakeTimers();
    const fetch: CheckoutFetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        const signal = init.signal as { addEventListener(type: "abort", listener: () => void): void };
        signal.addEventListener("abort", () => reject(new Error("The operation was aborted.")));
      });
    const asked = paddleCheckout(PADDLE, fetch)("player-alice");
    await vi.advanceTimersByTimeAsync(PADDLE_TIMEOUT_MS);
    expect(await asked).toEqual({ ok: false, reason: "timedOut" });
  });

  it("leaves no timer running once Paddle has answered", async () => {
    vi.useFakeTimers();
    const paddle = fakePaddle(async () => created());
    expect(await paddleCheckout(PADDLE, paddle.fetch)("player-alice")).toEqual({ ok: true, url: PAY_URL });
    expect([vi.getTimerCount(), aborted(paddle.signals[0])]).toEqual([0, false]);
  });
});
