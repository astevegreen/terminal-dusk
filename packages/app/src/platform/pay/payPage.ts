// What the pay page does (#685, Decision (architect) on the issue). The server's checkout address opens this page with
// a Paddle transaction in `_ptxn`; Paddle's script, once started, opens that checkout itself. The price and the card
// form are Paddle's: nothing here names a price, and the only token is the public client-side one.

export type PaddleOptions = {
  token: string;
  checkout: { settings: { successUrl: string } };
  eventCallback(event: { name?: string }): void;
};

/** The part of Paddle.js the page uses. */
export type PaddleApi = {
  Environment: { set(name: "sandbox"): void };
  Initialize(options: PaddleOptions): void;
};

export type PayPage = Readonly<{
  /** Paddle's public client-side token; empty in a build that can't take payment. */
  token: string;
  /** "sandbox" for Paddle's test mode. */
  environment: string;
  /** The page's query. */
  search: string;
  origin: string;
  loadPaddle(): Promise<PaddleApi>;
  go(url: string): void;
  say(words: string): void;
}>;

export const PAY_UNAVAILABLE = "Payment isn't available right now. Nothing was charged.";
export const PAY_NOTHING = "There is nothing to pay for here.";

export async function startPayPage(page: PayPage): Promise<void> {
  if (!new URLSearchParams(page.search).get("_ptxn")) return page.say(PAY_NOTHING);
  if (page.token === "") return page.say(PAY_UNAVAILABLE);
  const done = `${page.origin}/?purchase=done`;
  let completed = false;
  try {
    const paddle = await page.loadPaddle();
    if (page.environment === "sandbox") paddle.Environment.set("sandbox");
    paddle.Initialize({
      token: page.token,
      checkout: { settings: { successUrl: done } },
      eventCallback({ name }) {
        if (name === "checkout.completed") completed = true;
        if (name === "checkout.closed") page.go(completed ? done : "/");
      },
    });
  } catch {
    page.say(PAY_UNAVAILABLE);
  }
}
