// The app with what the player owns (#686): one sign-in session, shared with the online screens so a sign-in or
// sign-out there is seen at once, the entitlement session that follows it, and the Platform's purchases (#685). A
// build without online play has no account, so its player is free, nothing is asked and nothing is sold.
import { useEffect, useState, useSyncExternalStore } from "react";
import { App } from "../App.tsx";
import type { AppProps } from "../App.tsx";
import type { OnlineSetup } from "../online/OnlineScreen.tsx";
import { createSignIn } from "../online/signIn.ts";
import type { PlatformPurchases, PurchaseArrival } from "../platform/purchases.ts";
import { PurchaseNotice } from "../purchases/PurchaseControls.tsx";
import { EntitlementNotice } from "./EntitlementNotice.tsx";
import { createEntitlementSession } from "./session.ts";

export type EntitledAppProps = Omit<AppProps, "entitlements" | "signIn" | "notice" | "purchases">;

const noChanges: PlatformPurchases["subscribe"] = () => () => {};
const noArrival = (): PurchaseArrival => "none";

function SignedApp({ online, ...props }: Readonly<EntitledAppProps & { online: OnlineSetup }>) {
  // Made once, so a sign-in and what was read for it outlive every change of screen.
  const [{ signIn, entitlements, bought }] = useState(() => {
    const made = createSignIn({ auth: online.auth, store: online.store, now: props.clock });
    const read = createEntitlementSession({ endpoint: online.auth, signIn: made });
    const account = { endpoint: online.auth, accessToken: () => made.accessToken(), entitlements: read };
    return { signIn: made, entitlements: read, bought: online.purchases?.(account) };
  });
  const getArrival = bought?.getArrival ?? noArrival;
  const arrival = useSyncExternalStore(bought?.subscribe ?? noChanges, getArrival, getArrival);
  const { owned, state, known } = useSyncExternalStore(
    entitlements.subscribe,
    entitlements.getSnapshot,
    entitlements.getSnapshot,
  );
  useEffect(() => entitlements.start(), [entitlements]);
  // After the entitlements have started, so a return from the payment page reads them for the signed-in player.
  useEffect(() => bought?.start(), [bought]);
  const reload = (): void => void entitlements.reload();
  return (
    <App
      {...props}
      online={online}
      signIn={signIn}
      entitlements={{ owned, platform: online.platform }}
      {...(bought ? { purchases: bought } : {})}
      notice={
        <>
          <PurchaseNotice arrival={arrival} onRestore={reload} />
          <EntitlementNotice state={state} known={known} onRetry={reload} />
        </>
      }
    />
  );
}

export function EntitledApp({ online, ...props }: Readonly<EntitledAppProps>) {
  return online ? <SignedApp {...props} online={online} /> : <App {...props} />;
}
