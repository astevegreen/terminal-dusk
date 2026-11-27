// Unlock on the web (#685): signed out goes to sign-in, signed in asks the server for a checkout address and opens
// it, and only the app's own pay page is ever opened. Against the real sign-in and entitlement sessions and a fake
// server.
import { describe, expect, it } from "vitest";
import { WEB_ROW } from "../entitlements/test/fakeEntitlements.ts";
import { START, STORED, settle } from "../online/test/signInRig.ts";
import { APP_ORIGIN, purchaseRig } from "./test/purchaseRig.ts";

const CHECKOUT = `${APP_ORIGIN}/pay/?_ptxn=txn_01h8abcDEF`;
const ready = { status: 200, body: { ok: true, url: CHECKOUT } };
const refusal = (status: number, code: string) => ({
  status,
  body: { ok: false, error: { code, message: "server words" } },
});

describe("unlock (#685)", () => {
  it("unlock while signed out goes to sign-in, asking the server nothing and opening nothing", async () => {
    const { fake, purchases, opened } = await purchaseRig();
    await settle();
    await expect(purchases.unlock()).resolves.toEqual({ status: "signIn" });
    expect(fake.requests).toEqual([]);
    expect(opened).toEqual([]);
  });

  it("unlock while signed in asks the server for a checkout address and navigates to it", async () => {
    const { fake, purchases, opened } = await purchaseRig(STORED);
    await settle();
    fake.answerCall(ready);
    await expect(purchases.unlock()).resolves.toEqual({ status: "opened" });
    expect(fake.calls()).toHaveLength(1);
    const call = fake.calls()[0]!;
    expect(call.url).toBe("https://fake.supabase.test/functions/v1/checkout");
    expect(call.method).toBe("POST");
    expect(call.headers["Authorization"]).toBe(`Bearer ${STORED.accessToken}`);
    // No player id, price or product from the client: the server takes the player from the token.
    expect(JSON.parse(call.body as string)).toEqual({});
    expect(opened).toEqual([CHECKOUT]);
  });

  it.each([
    ["another site", "https://evil.test/pay/?_ptxn=txn_01h8abc"],
    ["a site whose name only starts like the app's", `${APP_ORIGIN}.evil.test/pay/?_ptxn=txn_01h8abc`],
    ["a script", "javascript:alert(1)"],
    ["another page of the app", `${APP_ORIGIN}/?_ptxn=txn_01h8abc`],
    ["a pay page without a transaction", `${APP_ORIGIN}/pay/`],
    ["a pay page with a transaction that is not one", `${APP_ORIGIN}/pay/?_ptxn=txn_%3Cx%3E`],
    ["not an address", "pay"],
    ["not words", 7],
  ])("opens only the app's own pay page: an address of %s is not opened", async (_what, url) => {
    const { fake, purchases, opened } = await purchaseRig(STORED);
    await settle();
    fake.answerCall({ status: 200, body: { ok: true, url } });
    await expect(purchases.unlock()).resolves.toEqual({ status: "refused", code: "network" });
    expect(opened).toEqual([]);
  });

  it.each([
    [409, "alreadyOwned", "alreadyOwned"],
    [503, "checkoutUnavailable", "checkoutUnavailable"],
    [401, "notSignedIn", "notSignedIn"],
    [500, "internalError", "network"],
    [404, "toString", "network"],
  ])("a %i %s reply opens nothing and is refused as %s", async (status, code, expected) => {
    const { fake, purchases, opened } = await purchaseRig(STORED);
    await settle();
    fake.answerCall(refusal(status, code));
    await expect(purchases.unlock()).resolves.toEqual({ status: "refused", code: expected });
    expect(opened).toEqual([]);
  });

  it("reads the entitlements again when the server says the player already owns it, so the offer goes", async () => {
    const { fake, entitlements, purchases } = await purchaseRig(STORED);
    await settle();
    fake.answerCall(refusal(409, "alreadyOwned"));
    fake.answerNext({ status: 200, body: [WEB_ROW] });
    await purchases.unlock();
    expect(entitlements.getSnapshot().owned).toEqual([WEB_ROW]);
  });

  it("is refused with network when the server can't be reached or its success reply has no yes", async () => {
    const { fake, purchases, opened } = await purchaseRig(STORED);
    await settle();
    fake.answerCall("throw");
    await expect(purchases.unlock()).resolves.toEqual({ status: "refused", code: "network" });
    fake.answerCall({ status: 200, body: { url: CHECKOUT } });
    await expect(purchases.unlock()).resolves.toEqual({ status: "refused", code: "network" });
    expect(opened).toEqual([]);
  });

  it("is refused with network, not sent to sign-in, when the expired token can't be refreshed for a moment", async () => {
    const { fake, purchases } = await purchaseRig({ ...STORED, expiresAt: START - 1 }, ({ auth }) => {
      auth.answerNext("throw"); // the refresh as the app starts
      auth.answerNext("throw"); // and the one for the unlock itself
    });
    await settle();
    await expect(purchases.unlock()).resolves.toEqual({ status: "refused", code: "network" });
    expect(fake.calls()).toEqual([]);
  });
});
