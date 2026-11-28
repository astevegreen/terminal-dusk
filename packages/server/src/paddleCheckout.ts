// Asks Paddle for a checkout: one "create transaction" request, with the player's id in the custom data the
// webhook reads back (paddleWebhookHandler.ts). The request itself is injected, so tests need no network.
// Nothing here logs, and Paddle's own text is never passed on: only the checkout address or a reason code.
import type { PlayerId } from "@terminal-dusk/host";
import { isPlainObject } from "./http.ts";

export type PaddleSettings = {
  /** Paddle's API, sandbox or live, with no slash at the end. */
  apiBase: string;
  apiKey: string;
  /** The price of the full game. */
  priceId: string;
  /** The full game's product: the price must belong to it, or the webhook would grant nothing for the sale. */
  productId: string;
  /** The web app's address, with no slash at the end: Paddle's checkout opens on its /pay/ page. */
  appUrl: string;
};

/** The part of the standard `fetch` the request needs. */
export type CheckoutFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal: unknown },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

/** `reason` is a code for the log: `unreachable`, `timedOut`, `status<number>` or `badAnswer`. The price check adds
 * `priceUnknown` (Paddle has no such price) and `priceNotOfProduct` (it belongs to another product), and prefixes
 * its other failures with `price`, as in `priceStatus500`. */
export type CheckoutAddress = { ok: true; url: string } | { ok: false; reason: string };

export type CreateCheckout = (player: PlayerId) => Promise<CheckoutAddress>;

export const PADDLE_TIMEOUT_MS = 10_000;

// The server's types have neither the DOM's nor Deno's names; both runtimes have these.
type Timers = {
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (timer: unknown) => void;
  AbortController: new () => { signal: unknown; abort: () => void };
};

const failed = (reason: string): CheckoutAddress => ({ ok: false, reason });

export function paddleCheckout(settings: PaddleSettings, fetch: CheckoutFetch): CreateCheckout {
  // A price once confirmed stays confirmed for the life of the function instance; a failure is asked again.
  let priceChecked = false;
  const attempt = async (player: PlayerId, signal: unknown): Promise<CheckoutAddress> => {
    if (!priceChecked) {
      const bad = await checkPrice(settings, fetch, signal);
      if (bad !== null) return failed(bad);
      priceChecked = true;
    }
    return ask(settings, fetch, player, signal);
  };
  return async (player) => {
    const runtime = globalThis as unknown as Timers;
    const cancel = new runtime.AbortController();
    let timer: unknown;
    const tooSlow = new Promise<CheckoutAddress>((resolve) => {
      timer = runtime.setTimeout(() => {
        // Resolve first: a real fetch fails as soon as it is cancelled, and that must still read as a time-out.
        resolve(failed("timedOut"));
        cancel.abort();
      }, PADDLE_TIMEOUT_MS);
    });
    try {
      return await Promise.race([attempt(player, cancel.signal), tooSlow]);
    } finally {
      runtime.clearTimeout(timer);
    }
  };
}

/** Asks Paddle whose price `priceId` is. Null when it is the full game's product, else a reason code. */
async function checkPrice(
  { apiBase, apiKey, priceId, productId }: PaddleSettings,
  fetch: CheckoutFetch,
  signal: unknown,
): Promise<string | null> {
  let answer: Awaited<ReturnType<CheckoutFetch>>;
  try {
    answer = await fetch(`${apiBase}/prices/${encodeURIComponent(priceId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
  } catch {
    return "priceUnreachable";
  }
  if (answer.status === 404) return "priceUnknown";
  if (answer.status < 200 || answer.status > 299) return `priceStatus${answer.status}`;
  try {
    const body = await answer.json();
    const data = isPlainObject(body) ? body.data : null;
    const found = isPlainObject(data) ? data.product_id : null;
    if (typeof found !== "string" || found === "") return "priceBadAnswer";
    return found === productId ? null : "priceNotOfProduct";
  } catch {
    return "priceBadAnswer";
  }
}

async function ask(
  { apiBase, apiKey, priceId, appUrl }: PaddleSettings,
  fetch: CheckoutFetch,
  player: PlayerId,
  signal: unknown,
): Promise<CheckoutAddress> {
  let answer: Awaited<ReturnType<CheckoutFetch>>;
  try {
    answer = await fetch(`${apiBase}/transactions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        custom_data: { player_id: player },
        checkout: { url: `${appUrl}/pay/` },
      }),
      signal,
    });
  } catch {
    return failed("unreachable");
  }
  if (answer.status < 200 || answer.status > 299) return failed(`status${answer.status}`);
  try {
    const url = checkoutUrl(await answer.json());
    return url === null ? failed("badAnswer") : { ok: true, url };
  } catch {
    return failed("badAnswer");
  }
}

/** `data.checkout.url` of Paddle's answer, if it is there. */
function checkoutUrl(body: unknown): string | null {
  const data = isPlainObject(body) ? body.data : null;
  const checkout = isPlainObject(data) ? data.checkout : null;
  const url = isPlainObject(checkout) ? checkout.url : null;
  return typeof url === "string" && url !== "" ? url : null;
}
