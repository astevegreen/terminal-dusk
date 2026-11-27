// The EntitlementReceipts contract (#683): what both MemoryEntitlementStore and SupabaseEntitlementStore must do
// when a purchase is granted or refunded by its receipt reference. It is checked through the ports, so one suite
// runs against the fake (stores.contract.test.ts) and the real tables (stores.contract.stack.test.ts).
import type { PlayerId } from "@terminal-dusk/host";
import { expect, it } from "vitest";
import type { EntitlementReceipts, UnmatchedReason } from "../../entitlementReceipts.ts";
import type { EntitlementStore } from "../../entitlementStore.ts";

/** What one contract test works with; `setup` gives a fresh one at the start of each test. */
export type EntitlementReceiptsHarness = {
  store: EntitlementStore & EntitlementReceipts;
  /** A player who owns nothing yet. */
  player(): PlayerId;
  /** A receipt reference no test has used. */
  receipt(): string;
  /** The reasons recorded for an unmatched receipt. */
  unmatched(source: string, receiptRef: string): Promise<UnmatchedReason[]>;
};

const COPY = { platform: "web", source: "paddle" } as const;
const byText = (a: string, b: string): number => (a < b ? -1 : Number(a > b));

/** Registers the EntitlementReceipts contract tests; call it inside a `describe`. */
export function entitlementReceiptsContract(setup: () => EntitlementReceiptsHarness, timeout?: number): void {
  const one = () => {
    const h = setup();
    return { h, s: h.store, player: h.player(), ref: h.receipt() };
  };

  it(
    "a granted receipt adds one entitlement for that player",
    async () => {
      const { s, h, player, ref } = one();
      const other = h.player();
      expect(await s.grantReceipt(player, COPY, ref)).toBe("granted");
      expect(await s.forPlayer(player)).toEqual([COPY]);
      expect(await s.forPlayer(other)).toEqual([]);
    },
    timeout,
  );

  it(
    "granting the same receipt twice adds one entitlement, even for another player",
    async () => {
      const { s, h, player, ref } = one();
      const other = h.player();
      await s.grantReceipt(player, COPY, ref);
      expect(await s.grantReceipt(player, COPY, ref)).toBe("already");
      expect(await s.grantReceipt(other, COPY, ref)).toBe("already");
      expect(await s.forPlayer(player)).toEqual([COPY]);
      expect(await s.forPlayer(other)).toEqual([]);
    },
    timeout,
  );

  it(
    "two grants of one receipt at once add one entitlement",
    async () => {
      const { s, player, ref } = one();
      const both = await Promise.all([s.grantReceipt(player, COPY, ref), s.grantReceipt(player, COPY, ref)]);
      expect(both.toSorted(byText)).toEqual(["already", "granted"]);
      expect(await s.forPlayer(player)).toEqual([COPY]);
    },
    timeout,
  );

  it(
    "revoking a receipt removes its entitlement and no other",
    async () => {
      const { s, h, player, ref } = one();
      await s.grantReceipt(player, COPY, ref);
      await s.grantReceipt(player, COPY, h.receipt());
      expect(await s.revokeReceipt("paddle", ref)).toBe("revoked");
      expect(await s.forPlayer(player)).toEqual([COPY]);
      expect(await s.revokeReceipt("paddle", ref)).toBe("remembered");
      expect(await s.forPlayer(player)).toEqual([COPY]);
    },
    timeout,
  );

  it(
    "revoking a receipt that never paid removes nothing",
    async () => {
      const { s, h, player, ref } = one();
      await s.grantReceipt(player, COPY, ref);
      expect(await s.revokeReceipt("paddle", h.receipt())).toBe("remembered");
      expect(await s.forPlayer(player)).toEqual([COPY]);
    },
    timeout,
  );

  it(
    "a refunded receipt stays refunded, whether the refund came after the grant or before it",
    async () => {
      const { s, h, player, ref } = one();
      await s.grantReceipt(player, COPY, ref);
      await s.revokeReceipt("paddle", ref);
      expect(await s.grantReceipt(player, COPY, ref)).toBe("refunded");

      const early = h.receipt();
      await s.revokeReceipt("paddle", early);
      expect(await s.grantReceipt(player, COPY, early)).toBe("refunded");
      expect(await s.forPlayer(player)).toEqual([]);
    },
    timeout,
  );

  it(
    "a grant and a refund of one receipt at once leave no entitlement",
    async () => {
      const { s, player, ref } = one();
      await Promise.all([s.grantReceipt(player, COPY, ref), s.revokeReceipt("paddle", ref)]);
      expect(await s.forPlayer(player)).toEqual([]);
    },
    timeout,
  );

  it(
    "a receipt reference belongs to its source: another source's refund leaves it",
    async () => {
      const { s, player, ref } = one();
      await s.grantReceipt(player, COPY, ref);
      expect(await s.revokeReceipt("another-source", ref)).toBe("remembered");
      expect(await s.forPlayer(player)).toEqual([COPY]);
    },
    timeout,
  );

  it(
    "an unmatched receipt is recorded once, with its first reason",
    async () => {
      const { s, h, ref } = one();
      await s.recordUnmatched("paddle", ref, "noPlayerId");
      await s.recordUnmatched("paddle", ref, "unknownPlayer");
      expect(await h.unmatched("paddle", ref)).toEqual(["noPlayerId"]);
      expect(await h.unmatched("paddle", h.receipt())).toEqual([]);
    },
    timeout,
  );
}
