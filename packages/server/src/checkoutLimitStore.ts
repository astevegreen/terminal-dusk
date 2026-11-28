// The checkout limit port: how many checkouts one player may open in an hour, and an in-memory store for tests.
// Each call to the checkout function makes a new Paddle transaction, so one account in a loop could pile up drafts
// and use up Paddle's request allowance for every buyer. Checking the count and recording the call are one step, so
// racing calls cannot get past the limit; the Supabase store does it in one locked SQL function (claim_checkout).
import type { PlayerId } from "@terminal-dusk/host";

/** Checkouts one player may open in the window. The SQL function claim_checkout hardcodes the same number. */
export const CHECKOUT_LIMIT = 10;
/** How long a checkout counts against its player: one hour. The SQL function hardcodes the same number. */
export const CHECKOUT_WINDOW_MS = 3_600_000;

/** `allowed`: the call was counted and may go on. `limited`: too many in the window; nothing was recorded. */
export const CLAIM_OUTCOMES = ["allowed", "limited"] as const;
export type ClaimOutcome = (typeof CLAIM_OUTCOMES)[number];

export const isClaimOutcome = (value: unknown): value is ClaimOutcome =>
  (CLAIM_OUTCOMES as readonly unknown[]).includes(value);

/** Where checkout calls are counted. The Supabase adapter and the in-memory store both implement it. */
export interface CheckoutLimitStore {
  /** Counts one checkout call by `player` at `now` (milliseconds), unless they are at the limit. */
  claim(player: PlayerId, now: number): Promise<ClaimOutcome>;
}

/** A `CheckoutLimitStore` held in memory, for tests. Claims run one at a time, as the SQL function's lock makes them. */
export class MemoryCheckoutLimitStore implements CheckoutLimitStore {
  readonly #calls: { player: PlayerId; at: number }[] = [];
  #queue: Promise<unknown> = Promise.resolve();

  claim(player: PlayerId, now: number): Promise<ClaimOutcome> {
    const next = this.#queue.then(() => this.#claimNow(player, now));
    this.#queue = next.catch(() => undefined);
    return next;
  }

  #claimNow(player: PlayerId, now: number): ClaimOutcome {
    const kept = this.#calls.filter((c) => c.player !== player || c.at > now - CHECKOUT_WINDOW_MS);
    this.#calls.splice(0, this.#calls.length, ...kept);
    if (this.#calls.filter((c) => c.player === player).length >= CHECKOUT_LIMIT) return "limited";
    this.#calls.push({ player, at: now });
    return "allowed";
  }
}
