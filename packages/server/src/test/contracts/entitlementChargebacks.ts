// The chargeback half of the EntitlementReceipts contract (#683): a chargeback takes a receipt's copy away and its
// reversal gives it back, whatever order Paddle's messages arrive in, and a refund stays final. It runs against the
// fake (stores.contract.test.ts) and the real tables (stores.contract.stack.test.ts).
import { expect, it } from "vitest";
import type { EntitlementReceiptsHarness } from "./entitlementReceipts.ts";

const COPY = { platform: "web", source: "paddle" } as const;
/** When Paddle made an adjustment: a later number is a later adjustment. */
const at = (day: number): number => 1_700_000_000_000 + day * 86_400_000;

/** Registers the chargeback contract tests; call it inside a `describe`. */
export function entitlementChargebacksContract(setup: () => EntitlementReceiptsHarness, timeout?: number): void {
  const one = () => {
    const h = setup();
    const player = h.player();
    const ref = h.receipt();
    const s = h.store;
    return {
      h,
      s,
      player,
      ref,
      grant: (buyer = player) => s.grantReceipt(buyer, COPY, ref),
      charge: (day: number) => s.chargeBackReceipt("paddle", ref, at(day)),
      reverse: (day: number) => s.reverseChargeback("paddle", ref, at(day)),
      owned: (buyer = player) => s.forPlayer(buyer),
    };
  };
  const test = (name: string, body: (t: ReturnType<typeof one>) => Promise<void>): void => {
    it(name, () => body(one()), timeout);
  };

  test("a chargeback removes that receipt's entitlement and no other, once", async (t) => {
    await t.grant();
    await t.s.grantReceipt(t.player, COPY, t.h.receipt());
    expect(await t.charge(1)).toBe("revoked");
    expect(await t.owned()).toEqual([COPY]);
    expect(await t.charge(1)).toBe("remembered");
    expect(await t.owned()).toEqual([COPY]);
  });

  test("a reversal gives the copy back to the same player, once", async (t) => {
    await t.grant();
    await t.charge(1);
    expect(await t.reverse(2)).toBe("restored");
    expect(await t.reverse(2)).toBe("remembered");
    expect(await t.owned()).toEqual([COPY]);
  });

  test("a reversal that arrives before its chargeback leaves the copy", async (t) => {
    await t.grant();
    expect(await t.reverse(2)).toBe("remembered");
    expect(await t.charge(1)).toBe("remembered");
    expect(await t.owned()).toEqual([COPY]);
  });

  test("a chargeback sent again after its reversal does not undo it", async (t) => {
    await t.grant();
    await t.charge(1);
    await t.reverse(2);
    expect(await t.charge(1)).toBe("remembered");
    expect(await t.owned()).toEqual([COPY]);
  });

  test("a later chargeback removes the copy again, and its reversal restores it", async (t) => {
    await t.grant();
    await t.charge(1);
    await t.reverse(2);
    expect(await t.charge(3)).toBe("revoked");
    expect(await t.reverse(2)).toBe("remembered");
    expect(await t.owned()).toEqual([]);
    expect(await t.reverse(4)).toBe("restored");
    expect(await t.owned()).toEqual([COPY]);
  });

  test("a second chargeback of a receipt with no copy keeps the buyer for the reversal", async (t) => {
    await t.grant();
    await t.charge(1);
    expect(await t.charge(2)).toBe("remembered");
    expect(await t.reverse(3)).toBe("restored");
    expect(await t.owned()).toEqual([COPY]);
  });

  test("a payment message during a chargeback is held, and the reversal gives that buyer the copy", async (t) => {
    const other = t.h.player();
    expect(await t.charge(1)).toBe("remembered");
    expect(await t.grant()).toBe("chargedBack");
    expect(await t.grant(other)).toBe("chargedBack");
    expect(await t.owned()).toEqual([]);
    expect(await t.reverse(2)).toBe("restored");
    expect(await t.owned()).toEqual([COPY]);
    expect(await t.owned(other)).toEqual([]);
    expect(await t.grant()).toBe("already");
  });

  test("a payment message arriving after both gives the copy", async (t) => {
    expect(await t.reverse(2)).toBe("remembered");
    await t.charge(1);
    expect(await t.owned()).toEqual([]);
    expect(await t.grant()).toBe("granted");
    expect(await t.owned()).toEqual([COPY]);
  });

  test("a reversal never lifts a refund that came before the chargeback", async (t) => {
    await t.grant();
    await t.s.revokeReceipt("paddle", t.ref);
    await t.charge(1);
    expect(await t.reverse(2)).toBe("remembered");
    expect(await t.grant()).toBe("refunded");
    expect(await t.owned()).toEqual([]);
  });

  test("a reversal never lifts a refund that came during the chargeback", async (t) => {
    await t.grant();
    await t.charge(1);
    expect(await t.s.revokeReceipt("paddle", t.ref)).toBe("remembered");
    expect(await t.reverse(2)).toBe("remembered");
    expect(await t.grant()).toBe("refunded");
    expect(await t.owned()).toEqual([]);
  });

  test("a grant and a chargeback at once leave no entitlement, and the reversal restores it", async (t) => {
    await Promise.all([t.grant(), t.charge(1)]);
    expect(await t.owned()).toEqual([]);
    expect(await t.reverse(2)).toBe("restored");
    expect(await t.owned()).toEqual([COPY]);
  });

  test("a chargeback and its reversal at once leave one entitlement", async (t) => {
    await t.grant();
    await Promise.all([t.charge(1), t.reverse(2)]);
    expect(await t.owned()).toEqual([COPY]);
  });

  test("another source's chargeback leaves the copy", async (t) => {
    await t.grant();
    expect(await t.s.chargeBackReceipt("another-source", t.ref, at(1))).toBe("remembered");
    expect(await t.owned()).toEqual([COPY]);
  });
}
