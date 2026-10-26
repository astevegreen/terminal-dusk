// The online game screen's wiring: makes A9a's online game session for one match id with the setup's Supabase
// project, the sign-in's token, the clock and the timers, draws OnlineGameView from its snapshots, and closes
// the session when the screen goes. Drawing and pressing are tested on OnlineGameView; this only connects them.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { CardId } from "@terminal-dusk/engine";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import { createOnlineGame } from "./onlineGame.ts";
import type { OnlineGame, OnlineGameOptions, OnlineGameSnapshot } from "./onlineGame.ts";
import { OnlineGameView } from "./OnlineGameView.tsx";
import type { SignIn } from "./signIn.ts";
import type { Timers } from "./timers.ts";
import type { AuthEndpoint } from "../transport/emailAuth.ts";

/** What every online game is played with: the clock, the timers, and how cards are named and asked about. */
export type PlaySetup = {
  clock: () => number;
  timers: Timers;
  label: (id: CardId) => string;
  question: CardQuestion;
  affiliation?: CardAffiliation | undefined;
};

/** The snapshot shown before the session is made: loading, with nothing else. */
export const LOADING_SNAPSHOT: OnlineGameSnapshot = {
  frame: null,
  log: [],
  era: null,
  turn: "loading",
  deadline: null,
  refusal: null,
};

/** What the session for `matchId` is built from: the setup's project, the sign-in's token, the clock and timers. */
export function onlineGameOptions(
  auth: AuthEndpoint,
  signIn: Pick<SignIn, "accessToken">,
  playerId: string,
  matchId: string,
  play: PlaySetup,
): OnlineGameOptions {
  return {
    url: auth.url,
    anonKey: auth.anonKey,
    matchId,
    playerId,
    accessToken: () => signIn.accessToken(),
    fetch: auth.fetch,
    now: play.clock,
    timers: play.timers,
  };
}

/**
 * Starts a session, shows it, and returns the clean-up that closes it when the screen goes. It runs as an
 * effect, so React's development double start makes and closes a spare session, nothing worse.
 */
export function openGame(start: () => OnlineGame, show: (game: OnlineGame) => void): () => void {
  const game = start();
  show(game);
  return () => game.close();
}

type ShownProps = { play: PlaySetup; onBack: () => void };

function Shown({ game, play, onBack }: Readonly<ShownProps & { game: OnlineGame }>) {
  const snapshot = useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot);
  return (
    <OnlineGameView
      snapshot={snapshot}
      game={game}
      label={play.label}
      question={play.question}
      affiliation={play.affiliation}
      onBack={onBack}
    />
  );
}

export type OnlineGameFlowProps = ShownProps & {
  auth: AuthEndpoint;
  signIn: SignIn;
  playerId: string;
  matchId: string;
};

export function OnlineGameFlow({ auth, signIn, playerId, matchId, play, onBack }: Readonly<OnlineGameFlowProps>) {
  // Made once per screen; the screen is keyed by the match id, so another game gets a fresh one.
  const [start] = useState(() => () => createOnlineGame(onlineGameOptions(auth, signIn, playerId, matchId, play)));
  const [game, setGame] = useState<OnlineGame | null>(null);
  useEffect(() => openGame(start, setGame), [start]);
  if (game === null)
    return (
      <OnlineGameView
        snapshot={LOADING_SNAPSHOT}
        game={null}
        label={play.label}
        question={play.question}
        affiliation={play.affiliation}
        onBack={onBack}
      />
    );
  return <Shown game={game} play={play} onBack={onBack} />;
}
