// The web purchases wired to the real sign-in and entitlement sessions over a fake Supabase (#685). Navigation is
// recorded, never done.
import { createEntitlementSession } from "../../entitlements/session.ts";
import { fakeEntitlements } from "../../entitlements/test/fakeEntitlements.ts";
import { SESSION_KEY, createSignIn } from "../../online/signIn.ts";
import { START, STORED } from "../../online/test/signInRig.ts";
import type { Session } from "../../transport/emailAuth.ts";
import { memoryStore } from "../storage.ts";
import { createWebPurchases } from "../webPurchases.ts";

/** The app's own address in these tests. */
export const APP_ORIGIN = "https://app.test";

/** `before` queues the fake's answers for what happens as the app starts. */
export async function purchaseRig(stored?: Session, before?: (fake: ReturnType<typeof fakeEntitlements>) => void) {
  const fake = fakeEntitlements({ [STORED.refreshToken]: STORED.userId });
  before?.(fake);
  const store = memoryStore();
  if (stored) await store.set(SESSION_KEY, JSON.stringify(stored));
  const endpoint = { url: "https://fake.supabase.test", anonKey: "fake-anon-key", fetch: fake.fetch };
  const signIn = createSignIn({ auth: endpoint, store, now: () => START });
  const entitlements = createEntitlementSession({ endpoint, signIn });
  /** Every address the purchases opened. */
  const opened: string[] = [];
  const purchases = createWebPurchases({
    endpoint,
    accessToken: () => signIn.accessToken(),
    entitlements,
    navigate: (url) => {
      opened.push(url);
    },
    origin: APP_ORIGIN,
  });
  entitlements.start();
  return { fake, store, signIn, entitlements, purchases, opened };
}
