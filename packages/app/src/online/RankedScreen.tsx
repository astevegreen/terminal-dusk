// The "Find a ranked game" screen with its session (#682): it reads a search left open when it opens, and while
// searching asks the server now and then whether the search has ended. The drawing is RankedView.
import { useEffect, useSyncExternalStore } from "react";
import type { RankedSession } from "./rankedSession.ts";
import { RankedView } from "./RankedView.tsx";
import type { Timers } from "./timers.ts";

/** How often a search asks whether it has ended. The job pairs once a minute, so a quarter minute is plenty. */
export const POLL_MS = 15_000;

export type RankedScreenProps = {
  session: RankedSession;
  timers: Timers;
  onOpen: (matchId: string) => void;
  onPlayAi: () => void;
  /** To where the Full Game is offered. */
  onFullGame: () => void;
  onBack: () => void;
};

export function RankedScreen({ session, timers, onOpen, onPlayAi, onFullGame, onBack }: Readonly<RankedScreenProps>) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  // start() does nothing once it has begun, so React's development double effect reads the search once.
  useEffect(() => void session.start(), [session]);
  const searching = snapshot.phase === "searching";
  useEffect(() => {
    if (!searching) return undefined;
    let handle: unknown = null;
    let stopped = false;
    const tick = (): void => {
      handle = timers.setTimer(() => {
        void session.poll().finally(() => {
          if (!stopped) tick();
        });
      }, POLL_MS);
    };
    tick();
    return () => {
      stopped = true;
      timers.clearTimer(handle);
    };
  }, [searching, session, timers]);
  return (
    <RankedView
      snapshot={snapshot}
      actions={session}
      onOpen={onOpen}
      onPlayAi={onPlayAi}
      onFullGame={onFullGame}
      onBack={onBack}
    />
  );
}
