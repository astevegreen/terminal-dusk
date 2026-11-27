// Restore and gift codes on the web (#685), against the real sign-in and entitlement sessions and a fake server.
import { describe, expect, it } from "vitest";
import { START, STORED, settle } from "../online/test/signInRig.ts";
import { WEB_ROW } from "../entitlements/test/fakeEntitlements.ts";
import { purchaseRig } from "./test/purchaseRig.ts";
import { PurchaseError } from "./purchases.ts";

const OWNS = { status: 200, body: [WEB_ROW] };
const CODE = "ABCDE-FGHIJ-KLMNP-QRSTU";
const REDEEMED = { status: 200, body: { ok: true, status: "redeemed", message: "server words" } };
const refusal = (status: number, code: string) => ({
  status,
  body: { ok: false, error: { code, message: "server words" } },
});

const refusedAs = async (call: Promise<unknown>): Promise<string> => {
  const error: unknown = await call.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof PurchaseError)) throw new Error("expected a purchase refusal");
  return error.code;
};

describe("redeemCode (#685)", () => {
  it("redeemCode with a good code succeeds: the code is sent with the player's token and the rows are read again", async () => {
    const { fake, entitlements, purchases } = await purchaseRig(STORED);
    await settle();
    fake.answerCall(REDEEMED);
    fake.answerNext(OWNS);
    await purchases.redeemCode(`  ${CODE} `);
    expect(fake.calls()).toHaveLength(1);
    const call = fake.calls()[0]!;
    expect(call.url).toBe("https://fake.supabase.test/functions/v1/redeem");
    expect(call.method).toBe("POST");
    expect(call.headers["Authorization"]).toBe(`Bearer ${STORED.accessToken}`);
    expect(JSON.parse(call.body as string)).toEqual({ code: CODE });
    expect(entitlements.getSnapshot().owned).toEqual([WEB_ROW]);
  });

  it("takes a code the same player already redeemed as success", async () => {
    const { fake, purchases } = await purchaseRig(STORED);
    await settle();
    fake.answerCall({ status: 200, body: { ok: true, status: "alreadyYours", message: "server words" } });
    await expect(purchases.redeemCode(CODE)).resolves.toBeUndefined();
  });

  it.each([
    [409, "codeUsed", "codeUsed"],
    [404, "unknownCode", "unknownCode"],
    [409, "alreadyOwned", "alreadyOwned"],
    [429, "tooManyGuesses", "tooManyGuesses"],
    [400, "illegalAnswer", "badCode"],
    [401, "notSignedIn", "notSignedIn"],
    [500, "storageFailed", "network"],
  ])("refuses a %i %s reply as %s", async (status, code, expected) => {
    const { fake, purchases } = await purchaseRig(STORED);
    await settle();
    fake.answerCall(refusal(status, code));
    expect(await refusedAs(purchases.redeemCode(CODE))).toBe(expected);
  });

  it("refuses with network when the server can't be reached or its success reply is unreadable", async () => {
    const { fake, purchases } = await purchaseRig(STORED);
    await settle();
    fake.answerCall("throw");
    expect(await refusedAs(purchases.redeemCode(CODE))).toBe("network");
    fake.answerCall({ status: 200, body: { ok: true } });
    expect(await refusedAs(purchases.redeemCode(CODE))).toBe("network");
  });

  it("asks nothing for an empty code", async () => {
    const { fake, purchases } = await purchaseRig(STORED);
    await settle();
    expect(await refusedAs(purchases.redeemCode("   "))).toBe("badCode");
    expect(fake.calls()).toEqual([]);
  });

  it("asks nothing while signed out", async () => {
    const { fake, purchases } = await purchaseRig();
    await settle();
    expect(await refusedAs(purchases.redeemCode(CODE))).toBe("notSignedIn");
    expect(fake.requests).toEqual([]);
  });

  it("refuses with network, not signed out, when the expired token can't be refreshed for a moment", async () => {
    const { fake, purchases } = await purchaseRig({ ...STORED, expiresAt: START - 1 }, ({ auth }) => {
      auth.answerNext("throw"); // the refresh as the app starts
      auth.answerNext("throw"); // and the one for the redeem itself
    });
    await settle();
    expect(await refusedAs(purchases.redeemCode(CODE))).toBe("network");
    expect(fake.calls()).toEqual([]);
  });
});

describe("restore (#685)", () => {
  it("restore reloads entitlements, so a web purchase made elsewhere appears", async () => {
    const { fake, entitlements, purchases } = await purchaseRig(STORED);
    await settle();
    expect(entitlements.getSnapshot().owned).toEqual([]);
    fake.answerNext(OWNS);
    await purchases.restore();
    expect(entitlements.getSnapshot().owned).toEqual([WEB_ROW]);
    expect(fake.reads()).toHaveLength(2);
  });

  it("takes away what the server no longer lists, so a refund never shows a stale owned", async () => {
    const { fake, entitlements, purchases } = await purchaseRig(STORED);
    fake.answerNext(OWNS);
    await settle();
    await purchases.restore();
    expect(entitlements.getSnapshot().owned).toEqual([]);
  });

  it("refuses with network when the read fails", async () => {
    const { fake, purchases } = await purchaseRig(STORED);
    await settle();
    fake.answerNext("throw");
    expect(await refusedAs(purchases.restore())).toBe("network");
  });

  it("refuses as signed out, asking nothing, while signed out", async () => {
    const { fake, purchases } = await purchaseRig();
    await settle();
    expect(await refusedAs(purchases.restore())).toBe("notSignedIn");
    expect(fake.requests).toEqual([]);
  });
});
