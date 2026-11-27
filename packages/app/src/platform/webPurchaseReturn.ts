// Coming back from the payment page (#685, Decision (architect) on the issue). The purchase reaches the server through
// Paddle's webhook, which may be a few seconds late, so the entitlements are read again at once and then a few more
// times, longer apart. The address only says "look": it grants nothing.
import type { EntitlementSession } from "../entitlements/session.ts";
import type { Timers } from "../online/timers.ts";
import type { PurchaseArrival } from "./purchases.ts";

/** The waits between the reads that follow the first, in milliseconds. */
export const RETURN_DELAYS = [2000, 4000, 8000, 16000, 30000] as const;

const PARAMETER = "purchase";

/** True for the address the payment page comes back to. */
export const purchaseReturned = (search: string): boolean => new URLSearchParams(search).get(PARAMETER) === "done";

/** The address without that mark, so a reload or a shared link does not look again. */
export function withoutPurchaseReturn(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(PARAMETER);
  return url.href;
}

type Setup = Readonly<{ returned: boolean; entitlements: EntitlementSession; timers: Timers }>;

export function createPurchaseReturn({ returned, entitlements, timers }: Setup) {
  const listeners = new Set<() => void>();
  let arrival: PurchaseArrival = "none";
  let found = false;

  const publish = (next: PurchaseArrival): void => {
    if (next === arrival) return;
    arrival = next;
    for (const listener of listeners) listener();
  };

  const owns = (): boolean => entitlements.getSnapshot().owned.some((row) => row.platform === "web");

  const watch = (): (() => void) => {
    let stopped = false;
    let waiting: unknown = null;
    const clear = (): void => {
      if (waiting !== null) timers.clearTimer(waiting);
      waiting = null;
    };
    const seen = (): void => {
      if (!owns()) return;
      found = true;
      clear();
      publish("none");
    };
    // A read from anywhere counts, also one after the last try (Restore).
    const unsubscribe = entitlements.subscribe(seen);
    const look = async (tries: number): Promise<void> => {
      await entitlements.reload();
      if (stopped || found) return;
      const delay = RETURN_DELAYS[tries];
      if (delay === undefined) return publish("late");
      waiting = timers.setTimer(() => {
        waiting = null;
        void look(tries + 1);
      }, delay);
    };
    publish("waiting");
    seen();
    if (!found) void look(0);
    return () => {
      stopped = true;
      clear();
      unsubscribe();
    };
  };

  return {
    start: (): (() => void) => (returned && !found ? watch() : () => {}),
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getArrival: (): PurchaseArrival => arrival,
  };
}
