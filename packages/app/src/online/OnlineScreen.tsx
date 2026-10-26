// The online screen (docs/architecture.md, Decision 7, "Guest mode": sign-in only when going online). It
// makes one sign-in session, reads the stored session on start and draws SignInView; once signed in it makes a
// lobby session for that player and draws LobbyView. With no `online` setup (a build without the Supabase
// settings) it shows the email step with Send code off.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Platform } from "@terminal-dusk/host";
import type { AuthEndpoint } from "../transport/emailAuth.ts";
import type { KeyValueStore } from "../platform/storage.ts";
import { createLobbySession } from "./lobbySession.ts";
import type { LobbySession } from "./lobbySession.ts";
import { LobbyView } from "./LobbyView.tsx";
import { createSignIn } from "./signIn.ts";
import type { SignIn, SignInSnapshot } from "./signIn.ts";
import { SignInView } from "./SignInView.tsx";

/**
 * Where Supabase is (its Auth, Edge Functions and tables share the one project URL), where the session is kept,
 * the platform games are created on and how text reaches the clipboard; built in main.tsx.
 */
export type OnlineSetup = {
  auth: AuthEndpoint;
  store: KeyValueStore;
  platform: Platform;
  copy: (text: string) => Promise<void> | void;
};

const NOT_SET_UP_SNAPSHOT: SignInSnapshot = { kind: "email", busy: false, refusal: null };

function LobbyScreen({ lobby, signIn, onBack }: Readonly<{ lobby: LobbySession; signIn: SignIn; onBack: () => void }>) {
  const snapshot = useSyncExternalStore(lobby.subscribe, lobby.getSnapshot, lobby.getSnapshot);
  // start() does nothing once it has begun, so React's development double effect reads My games once.
  useEffect(() => void lobby.start(), [lobby]);
  return <LobbyView snapshot={snapshot} actions={lobby} onSignOut={() => void signIn.signOut()} onBack={onBack} />;
}

function LobbyFlow({
  online,
  signIn,
  playerId,
  onBack,
}: Readonly<{ online: OnlineSetup; signIn: SignIn; playerId: string; onBack: () => void }>) {
  const [lobby] = useState(() =>
    createLobbySession({
      endpoint: online.auth,
      playerId,
      accessToken: () => signIn.accessToken(),
      platform: online.platform,
      copy: online.copy,
    }),
  );
  return <LobbyScreen lobby={lobby} signIn={signIn} onBack={onBack} />;
}

function SignInFlow({ online, signIn, onBack }: Readonly<{ online: OnlineSetup; signIn: SignIn; onBack: () => void }>) {
  const snapshot = useSyncExternalStore(signIn.subscribe, signIn.getSnapshot, signIn.getSnapshot);
  // start() does nothing once it has begun, so React's development double effect reads the store once.
  useEffect(() => void signIn.start(), [signIn]);
  if (snapshot.kind === "signedIn")
    // Keyed by the player, so a different player signing in gets a fresh lobby.
    return (
      <LobbyFlow key={snapshot.userId} online={online} signIn={signIn} playerId={snapshot.userId} onBack={onBack} />
    );
  return <SignInView snapshot={snapshot} actions={signIn} onBack={onBack} />;
}

function SetUpFlow({
  online,
  clock,
  onBack,
}: Readonly<{ online: OnlineSetup; clock: () => number; onBack: () => void }>) {
  const [signIn] = useState(() => createSignIn({ auth: online.auth, store: online.store, now: clock }));
  return <SignInFlow online={online} signIn={signIn} onBack={onBack} />;
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
