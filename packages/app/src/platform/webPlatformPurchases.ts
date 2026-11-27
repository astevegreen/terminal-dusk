// The web Platform's `purchases` as the web app's start makes them (#685): checkout in this tab, and the return from
// the payment page, read once and taken out of the address bar. Only the web build calls this; a store shell hands the
// app its own factory, or none (docs/architecture.md, Decision 7: no web checkout on iOS).
import type { Timers } from "../online/timers.ts";
import type { PurchasesFactory } from "./purchases.ts";
import { createPurchaseReturn, purchaseReturned, withoutPurchaseReturn } from "./webPurchaseReturn.ts";
import { createWebPurchases } from "./webPurchases.ts";

/** Said wherever the Full Game is sold on the web. The owner has not written the words yet. */
export const WEB_PURCHASE_NOTE = "Placeholder: a purchase on the web does not unlock other platforms.";

/** The parts of the browser window the web purchases use. */
export type PurchaseWindow = {
  location: Pick<Location, "href" | "origin" | "assign">;
  history: Pick<History, "replaceState" | "state">;
};

export function webPlatformPurchases({ location, history }: PurchaseWindow, timers: Timers): PurchasesFactory {
  const returned = purchaseReturned(new URL(location.href).search);
  if (returned) history.replaceState(history.state, "", withoutPurchaseReturn(location.href));
  return (account) => {
    const arrival = createPurchaseReturn({ returned, entitlements: account.entitlements, timers });
    return {
      purchases: createWebPurchases({
        ...account,
        navigate: (url) => location.assign(url),
        origin: location.origin,
      }),
      note: WEB_PURCHASE_NOTE,
      start: arrival.start,
      subscribe: arrival.subscribe,
      getArrival: arrival.getArrival,
    };
  };
}
