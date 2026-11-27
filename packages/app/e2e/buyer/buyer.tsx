// The test page behind the web purchase tests (#685): the real app, started as main.tsx starts it on the web, for a
// player who is already signed in and owns nothing. Supabase is a stand-in written here: no rows, a checkout address
// on this server's own pay page, every other request fails, and nothing reaches the network.
import { mountApp } from "../../src/appRoot.tsx";
import { SESSION_KEY } from "../../src/online/signIn.ts";
import { realTimers } from "../../src/online/timers.ts";
import { memoryStore } from "../../src/platform/storage.ts";
import { webPlatformPurchases } from "../../src/platform/webPlatformPurchases.ts";
import type { FetchLike } from "../../src/transport/remoteHttp.ts";

const answer = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const fetchStandIn: FetchLike = (url) => {
  if (url.includes("/rest/v1/")) return answer([]);
  if (url.endsWith("/functions/v1/checkout"))
    return answer({ ok: true, url: `${globalThis.location.origin}/pay/?_ptxn=txn_test1` });
  return Promise.reject(new Error("the buyer's test page has no network"));
};

const store = memoryStore();
// A session that has not expired in this test run, so no token refresh is asked for.
await store.set(
  SESSION_KEY,
  JSON.stringify({
    accessToken: "test-access",
    refreshToken: "test-refresh",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    userId: "00000000-0000-4000-8000-000000000685",
  }),
);
mountApp(
  { sounds: [] },
  {
    auth: { url: "https://buyer.test.invalid", anonKey: "test-anon-key", fetch: fetchStandIn },
    store,
    platform: "web",
    copy: () => {},
    purchases: webPlatformPurchases(globalThis, realTimers),
  },
);
