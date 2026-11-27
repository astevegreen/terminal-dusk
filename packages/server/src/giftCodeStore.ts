// The gift code port (docs/architecture.md, Decision 5: gift codes are a verified source of entitlements), and an
// in-memory store for tests. Claiming a code and granting its entitlement are one step, so two callers racing for
// one code cannot both get it; the Supabase store does it in one SQL transaction (redeem_gift_code). The store
// only ever sees a code's hash (giftCode.ts), never the code.
import type { PlayerId, Platform } from "@terminal-dusk/host";
import type { MemoryEntitlementStore } from "./entitlementStore.ts";

/** The source an entitlement from a gift code carries. */
export const GIFT_CODE_SOURCE = "gift code";
/** Wrong guesses one caller may make in the window before every try is refused. */
export const WRONG_GUESS_LIMIT = 10;
/** How long a wrong guess counts against its caller: one hour. */
export const WRONG_GUESS_WINDOW_MS = 3_600_000;

/**
 * What a redeem did. `redeemed`: the code was claimed and its entitlement granted. `alreadyYours`: the caller
 * redeemed it before; nothing new. `unknown`: no such code. `used`: someone else redeemed it. `owned`: the caller
 * already owns that platform, so the code stays unused. `limited`: too many wrong guesses in the last hour; the
 * code was not looked at. Only `unknown` and `used` count as wrong guesses.
 */
export const REDEEM_OUTCOMES = ["redeemed", "alreadyYours", "unknown", "used", "owned", "limited"] as const;
export type RedeemOutcome = (typeof REDEEM_OUTCOMES)[number];

export const isRedeemOutcome = (value: unknown): value is RedeemOutcome =>
  (REDEEM_OUTCOMES as readonly unknown[]).includes(value);

/** Where gift codes live. The Supabase adapter and the in-memory store both implement it. */
export interface GiftCodeStore {
  /** Redeems the code with that hash for `player` at `now` (milliseconds), all in one step. */
  redeem(hash: string, player: PlayerId, now: number): Promise<RedeemOutcome>;
}

/** One stored code: its hash and the one platform it is for. */
export type GiftCodeRow = { hash: string; platform: Platform };

/**
 * A `GiftCodeStore` held in memory, for tests, granting into a `MemoryEntitlementStore`. Redeems run one at a
 * time, as the SQL function's locks make them, so a race between two callers has one winner.
 */
export class MemoryGiftCodeStore implements GiftCodeStore {
  readonly #entitlements: MemoryEntitlementStore;
  readonly #codes = new Map<string, { platform: Platform; redeemedBy: PlayerId | null }>();
  readonly #attempts: { player: PlayerId; at: number }[] = [];
  #queue: Promise<unknown> = Promise.resolve();

  constructor(entitlements: MemoryEntitlementStore, codes: readonly GiftCodeRow[] = []) {
    this.#entitlements = entitlements;
    for (const { hash, platform } of codes) this.#codes.set(hash, { platform, redeemedBy: null });
  }

  redeem(hash: string, player: PlayerId, now: number): Promise<RedeemOutcome> {
    const next = this.#queue.then(() => this.#redeemNow(hash, player, now));
    this.#queue = next.catch(() => undefined);
    return next;
  }

  async #redeemNow(hash: string, player: PlayerId, now: number): Promise<RedeemOutcome> {
    const kept = this.#attempts.filter((a) => a.player !== player || a.at > now - WRONG_GUESS_WINDOW_MS);
    this.#attempts.splice(0, this.#attempts.length, ...kept);
    if (this.#attempts.filter((a) => a.player === player).length >= WRONG_GUESS_LIMIT) return "limited";
    const code = this.#codes.get(hash);
    if (!code) return this.#wrong(player, now, "unknown");
    if (code.redeemedBy === player) return "alreadyYours";
    if (code.redeemedBy !== null) return this.#wrong(player, now, "used");
    const owned = await this.#entitlements.forPlayer(player);
    if (owned.some((e) => e.platform === code.platform)) return "owned";
    code.redeemedBy = player;
    await this.#entitlements.grant(player, { platform: code.platform, source: GIFT_CODE_SOURCE });
    return "redeemed";
  }

  #wrong(player: PlayerId, at: number, outcome: "unknown" | "used"): RedeemOutcome {
    this.#attempts.push({ player, at });
    return outcome;
  }
}
