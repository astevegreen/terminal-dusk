// Browser entry point of index.html: reads the build's sound files and online settings and starts the app
// (appRoot.tsx).
import soundManifest from "virtual:sound-manifest";
import { mountApp } from "./appRoot.tsx";
import type { OnlineSetup } from "./online/OnlineScreen.tsx";
import { realTimers } from "./online/timers.ts";
import { webStore } from "./platform/storage.ts";
import { webPlatformPurchases } from "./platform/webPlatformPurchases.ts";

/**
 * Online play: Supabase from Vite's environment, the session kept in localStorage, games created as `web`, invite
 * codes copied with the browser's clipboard and the Full Game bought on the web (#685). Left out when either setting is missing, so the online
 * screen says online play is not set up in this build.
 */
function onlineSetup(): OnlineSetup | undefined {
  const url: unknown = import.meta.env.VITE_SUPABASE_URL;
  const anonKey: unknown = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== "string" || url === "" || typeof anonKey !== "string" || anonKey === "") return undefined;
  return {
    auth: { url, anonKey, fetch: (input, init) => fetch(input, init) },
    store: webStore(localStorage),
    platform: "web",
    copy: (text) => navigator.clipboard.writeText(text),
    purchases: webPlatformPurchases(globalThis, realTimers),
  };
}

mountApp(soundManifest, onlineSetup());
