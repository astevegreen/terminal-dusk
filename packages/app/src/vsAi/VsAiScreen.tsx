// Playing against the Easy AI: a side picker, then the game screen for the human's side. The AI runs in a
// Web Worker (createWorkerAi) unless a test passes another opponent. Seeds and the clock come from main.tsx.
import type { Side } from "@terminal-dusk/engine";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { GameScreen } from "../game/GameScreen.tsx";
import { ReplayScreen } from "../replay/ReplayScreen.tsx";
import type { ReplayRecording } from "../replay/recording.ts";
import { cardName } from "../testMode/fixture.ts";
import type { MakeAi } from "./aiOpponent.ts";
import { createVsAiSession } from "./session.ts";
import type { VsAiSession, VsAiSnapshot } from "./session.ts";
import { createWorkerAi } from "./workerAi.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;
export const PRACTICE_NOTE = "Practice game with developer test cards";

export function SidePicker({ onPick }: Readonly<{ onPick: (side: Side) => void }>) {
  return (
    <main>
      <h1>Play against the AI</h1>
      <p>{PRACTICE_NOTE}</p>
      <button type="button" style={TAP} onClick={() => onPick("lio")}>
        Play as LIO
      </button>
      <button type="button" style={TAP} onClick={() => onPick("sae")}>
        Play as SAE
      </button>
    </main>
  );
}

/** The game against the AI, drawn from a snapshot. */
export function VsAiView({
  snapshot,
  session,
  onNewGame,
}: Readonly<{ snapshot: VsAiSnapshot; session: VsAiSession; onNewGame: () => void }>) {
  const [watching, setWatching] = useState<ReplayRecording | null>(null);
  const { frame } = snapshot;
  if (watching) return <ReplayScreen recording={watching} label={cardName} onClose={() => setWatching(null)} />;
  return (
    <main>
      <p>{PRACTICE_NOTE}</p>
      {snapshot.aiRefusal && <p role="alert">{`AI refused: ${snapshot.aiRefusal}`}</p>}
      {frame ? (
        <GameScreen
          frame={frame}
          log={snapshot.log}
          era={snapshot.era}
          label={cardName}
          onAnswer={(value) => void session.answer(value)}
          refusal={snapshot.refusal}
        />
      ) : (
        <p role="alert">{`Could not start the game: ${snapshot.refusal ?? "unknown"}`}</p>
      )}
      {snapshot.replayReady && (
        <button type="button" style={TAP} onClick={() => setWatching(session.replay())}>
          Watch replay
        </button>
      )}
      {(!frame || frame.view.public.status.kind === "over") && (
        <button type="button" style={TAP} onClick={onNewGame}>
          New game
        </button>
      )}
    </main>
  );
}

/**
 * Starts a session, shows it, and returns the clean-up that stops it (and so the AI) when the screen goes.
 * It runs as an effect, so React's development double start makes and stops a spare session, nothing worse.
 */
export function openSession(start: () => VsAiSession, show: (session: VsAiSession) => void): () => void {
  const session = start();
  show(session);
  return () => session.stop();
}

function Game({ session, onNewGame }: Readonly<{ session: VsAiSession; onNewGame: () => void }>) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return <VsAiView snapshot={snapshot} session={session} onNewGame={onNewGame} />;
}

function Playing({ start, onNewGame }: Readonly<{ start: () => VsAiSession; onNewGame: () => void }>) {
  const [session, setSession] = useState<VsAiSession | null>(null);
  useEffect(() => openSession(start, setSession), [start]);
  return session ? <Game session={session} onNewGame={onNewGame} /> : null;
}

export type VsAiScreenProps = {
  clock: () => number;
  newSeed: () => string;
  newAiSeed: () => number;
  /** The AI opponent; the Web Worker one when left out. */
  makeAi?: MakeAi;
};

export function VsAiScreen({ clock, newSeed, newAiSeed, makeAi = createWorkerAi }: Readonly<VsAiScreenProps>) {
  const [side, setSide] = useState<Side | null>(null);
  const start = useCallback(
    () => createVsAiSession({ human: side ?? "lio", gameSeed: newSeed(), aiSeed: newAiSeed(), clock, makeAi }),
    [side, newSeed, newAiSeed, clock, makeAi],
  );
  if (!side) return <SidePicker onPick={setSide} />;
  return <Playing start={start} onNewGame={() => setSide(null)} />;
}
