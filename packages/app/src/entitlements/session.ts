// What the app knows the player owns (#686). It follows the sign-in session: a signed-in player's rows are read at
// once, a signed-out player owns nothing and nothing is asked. A read that fails keeps the last answer this player
// got, so an owner who goes offline stays an owner. `reload()` reads again (after a purchase or Restore, or when the
// player presses Try again). The answer is kept in memory only.
import type { Entitlement } from "@terminal-dusk/host";
import type { SignIn } from "../online/signIn.ts";
import { refuse } from "../online/lobbyHttp.ts";
import type { LobbyEndpoint, LobbyResult } from "../online/lobbyHttp.ts";
import { readEntitlements } from "./read.ts";

export type EntitlementState = "signedOut" | "loading" | "loaded" | "failed";

export type EntitlementSnapshot = Readonly<{
  /** What the last successful read for this player listed; empty before one. */
  owned: Entitlement[];
  state: EntitlementState;
  /** True once a read for this player has succeeded, so `owned` is an answer and not just "none yet". */
  known: boolean;
}>;

export type EntitlementSession = {
  getSnapshot(): EntitlementSnapshot;
  subscribe(listener: () => void): () => void;
  /** Starts the sign-in session and follows it; returns the call that stops following. */
  start(): () => void;
  /** Reads the signed-in player's rows again; does nothing when signed out. */
  reload(): Promise<void>;
};

const SIGNED_OUT: EntitlementSnapshot = { owned: [], state: "signedOut", known: false };

export function createEntitlementSession({
  endpoint,
  signIn,
}: Readonly<{ endpoint: LobbyEndpoint; signIn: SignIn }>): EntitlementSession {
  const listeners = new Set<() => void>();
  let snapshot = SIGNED_OUT;
  let player: string | null = null;
  // The number of the newest read; an older one that answers later is dropped.
  let latest = 0;

  const publish = (next: EntitlementSnapshot): void => {
    if (next.owned === snapshot.owned && next.state === snapshot.state && next.known === snapshot.known) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };

  /** The read's result; null when there turns out to be no session to read with. */
  const ask = async (asked: string): Promise<LobbyResult<Entitlement[]> | null> => {
    try {
      const token = await signIn.accessToken();
      return token === null ? null : await readEntitlements(endpoint, token, asked);
    } catch {
      // The token has expired and could not be refreshed just now: the player is still signed in.
      return refuse("network");
    }
  };

  const load = async (): Promise<void> => {
    const asked = player;
    if (asked === null) return;
    const mine = ++latest;
    publish({ ...snapshot, state: "loading" });
    const result = await ask(asked);
    if (result === null || mine !== latest || asked !== player) return;
    publish(result.ok ? { owned: result.value, state: "loaded", known: true } : { ...snapshot, state: "failed" });
  };

  /** Takes up a change of player: what one player owns is never shown for another. */
  const follow = (): void => {
    const current = signIn.getSnapshot();
    const next = current.kind === "signedIn" ? current.userId : null;
    if (next === player) return;
    player = next;
    publish(SIGNED_OUT);
    void load();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start() {
      const stop = signIn.subscribe(follow);
      // Does nothing once it has begun, so React's development double effect reads the stored session once.
      void signIn.start();
      follow();
      return stop;
    },
    reload: load,
  };
}
