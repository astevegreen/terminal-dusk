// The test page behind the tests of the full games (#686): the real app, started as main.tsx starts it, for a player
// who is already signed in and owns the Full Game. Supabase is a stand-in written here: its `entitlement` table
// holds one `web` row, every other request fails, and nothing reaches the network. The session is kept in memory, and
// the page has no sound files.
import { mountApp } from "../../src/appRoot.tsx";
import { SESSION_KEY } from "../../src/online/signIn.ts";
import { memoryStore } from "../../src/platform/storage.ts";
import type { FetchLike } from "../../src/transport/remoteHttp.ts";

const fetchStandIn: FetchLike = (url) =>
  url.includes("/rest/v1/entitlement")
    ? Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ platform: "web", source: "stripe" }]),
      })
    : Promise.reject(new Error("the owner's test page has no network"));

const store = memoryStore();
// A session that has not expired in this test run, so no token refresh is asked for.
await store.set(
  SESSION_KEY,
  JSON.stringify({
    accessToken: "test-access",
    refreshToken: "test-refresh",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    userId: "test-owner",
  }),
);
mountApp(
  { sounds: [] },
  {
    auth: { url: "https://owner.test.invalid", anonKey: "test-anon-key", fetch: fetchStandIn },
    store,
    platform: "web",
    copy: () => {},
  },
);
