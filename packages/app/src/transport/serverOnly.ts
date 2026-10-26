// Online requests go only to the game's own server: the Supabase address this build was made with. main.tsx
// wraps the browser's fetch with this, so no request can be sent anywhere else, whatever builds its URL.
import type { FetchLike } from "./remoteHttp.ts";

/** `fetch`, refusing (without sending) any request whose URL is not under `server`. */
export function serverOnly(server: string, fetch: FetchLike): FetchLike {
  let base = server;
  while (base.endsWith("/")) base = base.slice(0, -1);
  const prefix = `${base}/`;
  return (url, init) =>
    url.startsWith(prefix) ? fetch(url, init) : Promise.reject(new Error("a request was not for the game's server"));
}
