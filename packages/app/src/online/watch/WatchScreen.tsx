// The watch screen's wiring: a watch session for one match id (always a spectator, no sign-in needed), drawn by
// WatchView, closed when the screen goes. When the game is over it asks for the replay once, if the build has a
// way to load one. Drawing is tested on WatchView; this only connects.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ReplayRecording } from "../../replay/recording.ts";
import type { AuthEndpoint } from "../../transport/emailAuth.ts";
import { LOADING_SNAPSHOT, openGame } from "../OnlineGameScreen.tsx";
import type { PlaySetup } from "../OnlineGameScreen.tsx";
import { createWatchGame } from "./watchGame.ts";
import { WatchView } from "./WatchView.tsx";
import type { WatchReplay } from "./WatchView.tsx";
import type { OnlineGame } from "../onlineGame.ts";

export type WatchScreenProps = {
  auth: AuthEndpoint;
  matchId: string;
  play: PlaySetup;
  /** Loads a finished game's replay; null when there is none. Left out where replays are not served yet. */
  loadReplay?: ((matchId: string) => Promise<ReplayRecording | null>) | undefined;
  onBack: () => void;
};

/** The replay for a finished game: the loaded recording, or "none" when there is no loader, nothing, or a failure. */
export async function replayFor(
  load: WatchScreenProps["loadReplay"],
  matchId: string,
): Promise<ReplayRecording | "none"> {
  if (load === undefined) return "none";
  return (await load(matchId).catch(() => null)) ?? "none";
}

/** What the screen is given for a finished game: asks `loadReplay` once; a failure or nothing is "none". */
export function useReplay(over: boolean, matchId: string, load: WatchScreenProps["loadReplay"]): WatchReplay {
  const [replay, setReplay] = useState<WatchReplay>(null);
  useEffect(() => {
    if (!over) return;
    let current = true;
    void replayFor(load, matchId).then((found) => {
      if (current) setReplay(found);
    });
    return () => {
      current = false;
    };
  }, [over, matchId, load]);
  return replay;
}

function Shown({
  game,
  play,
  matchId,
  loadReplay,
  onBack,
}: Readonly<Omit<WatchScreenProps, "auth"> & { game: OnlineGame }>) {
  const snapshot = useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot);
  const replay = useReplay(snapshot.turn === "over", matchId, loadReplay);
  return (
    <WatchView
      snapshot={snapshot}
      replay={replay}
      label={play.label}
      question={play.question}
      rules={play.rules}
      affiliation={play.affiliation}
      onBack={() => {
        game.close();
        onBack();
      }}
    />
  );
}

export function WatchScreen({ auth, matchId, play, loadReplay, onBack }: Readonly<WatchScreenProps>) {
  const [start] = useState(
    () => () =>
      createWatchGame({
        url: auth.url,
        anonKey: auth.anonKey,
        matchId,
        fetch: auth.fetch,
        now: play.clock,
        label: play.label,
        timers: play.timers,
      }),
  );
  const [game, setGame] = useState<OnlineGame | null>(null);
  useEffect(() => openGame(start, setGame), [start]);
  if (game === null) {
    return (
      <WatchView
        snapshot={LOADING_SNAPSHOT}
        replay={null}
        label={play.label}
        question={play.question}
        rules={play.rules}
        affiliation={play.affiliation}
        onBack={onBack}
      />
    );
  }
  return <Shown game={game} play={play} matchId={matchId} loadReplay={loadReplay} onBack={onBack} />;
}
