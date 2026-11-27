// The app with what the player owns (#686): one sign-in session, shared with the online screens so a sign-in or
// sign-out there is seen at once, and the entitlement session that follows it. A build without online play has no
// account, so its player is free and nothing is asked.
import { useEffect, useState, useSyncExternalStore } from "react";
import { App } from "../App.tsx";
import type { AppProps } from "../App.tsx";
import type { OnlineSetup } from "../online/OnlineScreen.tsx";
import { createSignIn } from "../online/signIn.ts";
import { EntitlementNotice } from "./EntitlementNotice.tsx";
import { createEntitlementSession } from "./session.ts";

export type EntitledAppProps = Omit<AppProps, "entitlements" | "signIn" | "notice">;

function SignedApp({ online, ...props }: Readonly<EntitledAppProps & { online: OnlineSetup }>) {
  // Made once, so a sign-in and what was read for it outlive every change of screen.
  const [{ signIn, entitlements }] = useState(() => {
    const made = createSignIn({ auth: online.auth, store: online.store, now: props.clock });
    return { signIn: made, entitlements: createEntitlementSession({ endpoint: online.auth, signIn: made }) };
  });
  const { owned, state, known } = useSyncExternalStore(
    entitlements.subscribe,
    entitlements.getSnapshot,
    entitlements.getSnapshot,
  );
  useEffect(() => entitlements.start(), [entitlements]);
  return (
    <App
      {...props}
      online={online}
      signIn={signIn}
      entitlements={{ owned, platform: online.platform }}
      notice={<EntitlementNotice state={state} known={known} onRetry={() => void entitlements.reload()} />}
    />
  );
}

export function EntitledApp({ online, ...props }: Readonly<EntitledAppProps>) {
  return online ? <SignedApp {...props} online={online} /> : <App {...props} />;
}
