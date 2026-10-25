// The online screen (docs/architecture.md, Decision 7, "Guest mode": sign-in only when going online). It
// makes one sign-in session, reads the stored session on start and draws SignInView. With no `online` setup
// (a build without the Supabase settings) it shows the email step with Send code off. The lobby (A8) will
// replace the signed-in step.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AuthEndpoint } from "../transport/emailAuth.ts";
import type { KeyValueStore } from "../platform/storage.ts";
import { createSignIn } from "./signIn.ts";
import type { SignIn, SignInSnapshot } from "./signIn.ts";
import { SignInView } from "./SignInView.tsx";

/** Where Supabase Auth is and where the session is kept; built in main.tsx. */
export type OnlineSetup = { auth: AuthEndpoint; store: KeyValueStore };

const NOT_SET_UP_SNAPSHOT: SignInSnapshot = { kind: "email", busy: false, refusal: null };

function SignInFlow({ signIn, onBack }: Readonly<{ signIn: SignIn; onBack: () => void }>) {
  const snapshot = useSyncExternalStore(signIn.subscribe, signIn.getSnapshot, signIn.getSnapshot);
  // start() does nothing once it has begun, so React's development double effect reads the store once.
  useEffect(() => void signIn.start(), [signIn]);
  return <SignInView snapshot={snapshot} actions={signIn} onBack={onBack} />;
}

function SetUpFlow({
  online,
  clock,
  onBack,
}: Readonly<{ online: OnlineSetup; clock: () => number; onBack: () => void }>) {
  const [signIn] = useState(() => createSignIn({ auth: online.auth, store: online.store, now: clock }));
  return <SignInFlow signIn={signIn} onBack={onBack} />;
}

export type OnlineScreenProps = {
  /** Left out when this build has no online play set up. */
  online?: OnlineSetup | undefined;
  clock: () => number;
  /** Returns to the home screen. */
  onBack: () => void;
};

export function OnlineScreen({ online, clock, onBack }: Readonly<OnlineScreenProps>) {
  if (!online) return <SignInView snapshot={NOT_SET_UP_SNAPSHOT} actions={null} onBack={onBack} />;
  return <SetUpFlow online={online} clock={clock} onBack={onBack} />;
}
