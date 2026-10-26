// The online screen (docs/architecture.md, Decision 7, "Guest mode": sign-in only when going online). It
// makes one sign-in session, reads the stored session on start and draws SignInView; once signed in it makes a
// lobby session for that player and draws LobbyView, or the online game screen for the game opened from My games
// or just joined. With no `online` setup (a build without the Supabase settings) it shows the email step with
// Send code off.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReactElement } from "react";
import type { CardId } from "@terminal-dusk/engine";
import type { Platform } from "@terminal-dusk/host";
import type { CardQuestion } from "../decisionPrompts.tsx";
import { cardName, cardQuestion } from "../testMode/fixture.ts";
import type { AuthEndpoint } from "../transport/emailAuth.ts";
import type { KeyValueStore } from "../platform/storage.ts";
import { createLobbySession } from "./lobbySession.ts";
import type { LobbyOptions, LobbySession } from "./lobbySession.ts";
import { OnlineGameFlow } from "./OnlineGameScreen.tsx";
import type { PlaySetup } from "./OnlineGameScreen.tsx";
import type { Timers } from "./timers.ts";
import { LobbyView } from "./LobbyView.tsx";
import type { LobbyActions } from "./LobbyView.tsx";
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

/**
 * The lobby's actions, with joining changed so that a successful join opens its game at once: after Join (or
 * the side pick) finishes, a newly joined game is opened.
 */
export function openingActions(lobby: LobbySession, onOpen: (matchId: string) => void): LobbyActions {
  const thenOpen = async (joining: Promise<void>): Promise<void> => {
    const before = lobby.getSnapshot().join.joined;
    await joining;
    const after = lobby.getSnapshot().join.joined;
    if (after !== null && after !== before) onOpen(after.matchId);
  };
  return {
    chooseSides: (sides) => lobby.chooseSides(sides),
    chooseDays: (days) => lobby.chooseDays(days),
    chooseRule: (rule) => lobby.chooseRule(rule),
    create: () => lobby.create(),
    copyCode: () => lobby.copyCode(),
    join: (code) => thenOpen(lobby.join(code)),
    pickSide: (side) => thenOpen(lobby.pickSide(side)),
    codeChanged: () => lobby.codeChanged(),
    refresh: () => lobby.refresh(),
  };
}

/** Back from a game: the lobby shows again and reads My games again. */
export function backToLobby(lobby: LobbySession, show: (matchId: string | null) => void): void {
  show(null);
  void lobby.refresh();
}

type LobbyScreenProps = { lobby: LobbySession; signIn: SignIn; onBack: () => void; onOpen: (matchId: string) => void };

function LobbyScreen({ lobby, signIn, onBack, onOpen }: Readonly<LobbyScreenProps>) {
  const snapshot = useSyncExternalStore(lobby.subscribe, lobby.getSnapshot, lobby.getSnapshot);
  // start() does nothing once it has begun, so React's development double effect reads My games once.
  useEffect(() => void lobby.start(), [lobby]);
  const [actions] = useState(() => openingActions(lobby, onOpen));
  return (
    <LobbyView
      snapshot={snapshot}
      actions={actions}
      onSignOut={() => void signIn.signOut()}
      onBack={onBack}
      onOpen={onOpen}
    />
  );
}

/** What the lobby session for `playerId` is built from: the setup's endpoint, platform and copy, and the sign-in's token. */
export function lobbyOptions(online: OnlineSetup, signIn: SignIn, playerId: string): LobbyOptions {
  return {
    endpoint: online.auth,
    playerId,
    accessToken: () => signIn.accessToken(),
    platform: online.platform,
    copy: online.copy,
  };
}

type FlowProps = { online: OnlineSetup; signIn: SignIn; play: PlaySetup; onBack: () => void };
type PlayerProps = FlowProps & { playerId: string };

type LobbyStepProps = PlayerProps & {
  lobby: LobbySession;
  /** The match id of the open game, or null for the lobby. */
  open: string | null;
  show: (matchId: string | null) => void;
};

/** What a signed-in player sees: the open game, keyed by its match id, or else the lobby. */
export function lobbyStep({ online, signIn, play, onBack, playerId, lobby, open, show }: LobbyStepProps): ReactElement {
  if (open !== null)
    return (
      <OnlineGameFlow
        key={open}
        auth={online.auth}
        signIn={signIn}
        playerId={playerId}
        matchId={open}
        play={play}
        onBack={() => backToLobby(lobby, show)}
      />
    );
  return <LobbyScreen lobby={lobby} signIn={signIn} onBack={onBack} onOpen={show} />;
}

export function LobbyFlow(props: Readonly<PlayerProps>) {
  const { online, signIn, playerId } = props;
  const [lobby] = useState(() => createLobbySession(lobbyOptions(online, signIn, playerId)));
  const [open, show] = useState<string | null>(null);
  return lobbyStep({ ...props, lobby, open, show });
}

/** What the online screen draws for one sign-in snapshot: the lobby once signed in, else the sign-in steps. */
export function onlineStep(snapshot: SignInSnapshot, props: Readonly<FlowProps>): ReactElement {
  const { online, signIn, play, onBack } = props;
  if (snapshot.kind === "signedIn")
    // Keyed by the player, so a different player signing in gets a fresh lobby.
    return (
      <LobbyFlow
        key={snapshot.userId}
        online={online}
        signIn={signIn}
        play={play}
        playerId={snapshot.userId}
        onBack={onBack}
      />
    );
  return <SignInView snapshot={snapshot} actions={signIn} onBack={onBack} />;
}

export function SignInFlow(props: Readonly<FlowProps>) {
  const { signIn } = props;
  const snapshot = useSyncExternalStore(signIn.subscribe, signIn.getSnapshot, signIn.getSnapshot);
  // start() does nothing once it has begun, so React's development double effect reads the store once.
  useEffect(() => void signIn.start(), [signIn]);
  return onlineStep(snapshot, props);
}

function SetUpFlow({ online, onBack, ...setup }: Readonly<PlaySetup & { online: OnlineSetup; onBack: () => void }>) {
  // Made once, so the sign-in, the lobby and each game below keep the same setup across renders.
  const [play] = useState<PlaySetup>(() => setup);
  const [signIn] = useState(() => createSignIn({ auth: online.auth, store: online.store, now: play.clock }));
  return <SignInFlow online={online} signIn={signIn} play={play} onBack={onBack} />;
}

export type OnlineScreenProps = {
  /** Left out when this build has no online play set up. */
  online?: OnlineSetup | undefined;
  clock: () => number;
  /** The timers an online game polls with: the real ones from main.tsx, fake ones in tests. */
  timers: Timers;
  /** How cards are named and asked about; the developer fixture's when left out, as for the game against the AI. */
  label?: ((id: CardId) => string) | undefined;
  question?: CardQuestion | undefined;
  /** Returns to the home screen. */
  onBack: () => void;
};

export function OnlineScreen({
  online,
  clock,
  timers,
  label = cardName,
  question = cardQuestion,
  onBack,
}: Readonly<OnlineScreenProps>) {
  if (!online) return <SignInView snapshot={NOT_SET_UP_SNAPSHOT} actions={null} onBack={onBack} />;
  return <SetUpFlow online={online} clock={clock} timers={timers} label={label} question={question} onBack={onBack} />;
}
