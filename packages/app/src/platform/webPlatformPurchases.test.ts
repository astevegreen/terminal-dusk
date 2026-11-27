// The web Platform's purchases as main.tsx makes them (#685): the return from payment is read once and taken out of
// the address bar, the pay page is opened in the same tab, and the offer is told what a web purchase doesn't include.
import { describe, expect, it } from "vitest";
import { createEntitlementSession } from "../entitlements/session.ts";
import { fakeEntitlements } from "../entitlements/test/fakeEntitlements.ts";
import { SESSION_KEY, createSignIn } from "../online/signIn.ts";
import { START, STORED } from "../online/test/signInRig.ts";
import { fakeTimers, settle } from "../transport/test/remoteGame.ts";
import { memoryStore } from "./storage.ts";
import { WEB_PURCHASE_NOTE, webPlatformPurchases } from "./webPlatformPurchases.ts";

async function platform(href: string) {
  const replaced: string[] = [];
  const assigned: string[] = [];
  const factory = webPlatformPurchases(
    {
      location: { href, origin: new URL(href).origin, assign: (url) => void assigned.push(String(url)) },
      history: { state: null, replaceState: (_state, _title, url) => void replaced.push(String(url)) },
    },
    fakeTimers(),
  );
  const fake = fakeEntitlements({ [STORED.refreshToken]: STORED.userId });
  const store = memoryStore();
  await store.set(SESSION_KEY, JSON.stringify(STORED));
  const endpoint = { url: "https://fake.supabase.test", anonKey: "fake-anon-key", fetch: fake.fetch };
  const signIn = createSignIn({ auth: endpoint, store, now: () => START });
  const entitlements = createEntitlementSession({ endpoint, signIn });
  entitlements.start();
  await settle();
  const made = factory({ endpoint, accessToken: () => signIn.accessToken(), entitlements });
  return { made, fake, replaced, assigned };
}

describe("the web Platform's purchases (#685)", () => {
  it("says, labelled as a placeholder, that a web purchase does not unlock other platforms", () => {
    expect(WEB_PURCHASE_NOTE).toMatch(/^Placeholder: .*does not unlock other platforms/);
  });

  it("offers unlock, restore and redeemCode, and opens the pay page in this tab", async () => {
    const { made, fake, assigned } = await platform("https://app.test/");
    expect(made.note).toBe(WEB_PURCHASE_NOTE);
    expect(made.purchases.redeemCode).toBeDefined();
    const url = "https://app.test/pay/?_ptxn=txn_01h8abc";
    fake.answerCall({ status: 200, body: { ok: true, url } });
    await made.purchases.unlock();
    expect(assigned).toEqual([url]);
  });

  it("reads the return from payment once, takes it out of the address bar and checks for the purchase", async () => {
    const { made, fake, replaced } = await platform("https://app.test/?purchase=done");
    expect(replaced).toEqual(["https://app.test/"]);
    const before = fake.reads().length;
    const stop = made.start();
    expect(made.getArrival()).toBe("waiting");
    await settle();
    expect(fake.reads()).toHaveLength(before + 1);
    stop();
  });

  it("leaves an ordinary address alone", async () => {
    const { made, replaced } = await platform("https://app.test/?watch=m1");
    made.start();
    expect(replaced).toEqual([]);
    expect(made.getArrival()).toBe("none");
  });
});
