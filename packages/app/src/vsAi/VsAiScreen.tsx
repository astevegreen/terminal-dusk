// Playing against the Easy AI: a side picker, then the game screen for the human's side. The AI runs in a
// Web Worker (createWorkerAi) unless a test passes another opponent. Seeds and the clock come from main.tsx.
import { SIDES } from "@terminal-dusk/engine";
import type { CardId, Ruleset, Side } from "@terminal-dusk/engine";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { FocusingGameScreen } from "../game/decisionFocus.tsx";
import { ReplayScreen } from "../replay/ReplayScreen.tsx";
import type { ReplayRecording } from "../replay/recording.ts";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import { SIDE_NAME, SIDE_WHO, sideFullName } from "../displayText.ts";
import type { CardRules } from "../displayText.ts";
import { cardAffiliation as fixtureAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import type { MakeAi } from "./aiOpponent.ts";
import { createVsAiSession } from "./session.ts";
import type { VsAiOptions } from "./session.ts";
import type { VsAiSession, VsAiSnapshot } from "./session.ts";
import { createWorkerAi } from "./workerAi.ts";

const TAP = { minHeight: 44, minWidth: 44 } as const;
export const PRACTICE_NOTE = "Practice game with developer test cards";

/** A game to play against the AI: its rules, how it starts, how its cards are named and the note shown above it. */
export type VsAiGame = {
  ruleset: Ruleset;
  makeMatch: NonNullable<VsAiOptions["makeMatch"]>;
  cardName: (id: CardId) => string;
  /** A card's yes/no question, shown in its prompt (undefined: the plain "yes or no?" text). */
  cardQuestion: CardQuestion;
  /** Whose each card is, so a prompt offers only the plays the card allows. */
  cardAffiliation: CardAffiliation;
  /** A card's rules text, shown under its name in the hand; left out, the hand shows names only. */
  cardRules?: CardRules | undefined;
  note: string;
};

export function SidePicker({
  onPick,
  note = PRACTICE_NOTE,
}: Readonly<{ onPick: (side: Side) => void; note?: string | undefined }>) {
  return (
    <main>
      <h1>Play against the AI</h1>
      <p>{note}</p>
      {SIDES.map((side) => (
        <div key={side}>
          <button type="button" style={TAP} onClick={() => onPick(side)}>
            {`Play as ${SIDE_NAME[side]}`}
          </button>
          <p>{`${sideFullName(side)}: ${SIDE_WHO[side]}`}</p>
        </div>
      ))}
    </main>
  );
}

/** The game against the AI, drawn from a snapshot. */
export function VsAiView({
  snapshot,
  session,
  onNewGame,
  note = PRACTICE_NOTE,
  label = cardName,
  question = cardQuestion,
  affiliation = fixtureAffiliation,
  rules,
}: Readonly<{
  snapshot: VsAiSnapshot;
  session: VsAiSession;
  onNewGame: () => void;
  note?: string | undefined;
  label?: ((id: CardId) => string) | undefined;
  question?: CardQuestion | undefined;
  affiliation?: CardAffiliation | undefined;
  /** A card's rules text for the hand; left out, as for the developer fixture, the hand shows names only. */
  rules?: CardRules | undefined;
}>) {
  const [watching, setWatching] = useState<ReplayRecording | null>(null);
  const { frame } = snapshot;
  if (watching)
    return (
      <ReplayScreen
        recording={watching}
        label={label}
        question={question}
        affiliation={affiliation}
        rules={rules}
        onClose={() => setWatching(null)}
      />
    );
  return (
    <main className="game-page">
      <p>{note}</p>
      {snapshot.aiRefusal && <p role="alert">{`AI refused: ${snapshot.aiRefusal}`}</p>}
      {frame ? (
        <FocusingGameScreen
          frame={frame}
          log={snapshot.log}
          era={snapshot.era}
          label={label}
          question={question}
          affiliation={affiliation}
          rules={rules}
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

function Game({
  session,
  onNewGame,
  game,
}: Readonly<{ session: VsAiSession; onNewGame: () => void; game?: VsAiGame | undefined }>) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return (
    <VsAiView
      snapshot={snapshot}
      session={session}
      onNewGame={onNewGame}
      note={game?.note}
      label={game?.cardName}
      question={game?.cardQuestion}
      affiliation={game?.cardAffiliation}
      rules={game?.cardRules}
    />
  );
}

function Playing({
  start,
  onNewGame,
  game,
}: Readonly<{ start: () => VsAiSession; onNewGame: () => void; game?: VsAiGame | undefined }>) {
  const [session, setSession] = useState<VsAiSession | null>(null);
  useEffect(() => openSession(start, setSession), [start]);
  return session ? <Game session={session} onNewGame={onNewGame} game={game} /> : null;
}

export type VsAiScreenProps = {
  clock: () => number;
  newSeed: () => string;
  newAiSeed: () => number;
  /** The AI opponent; the Web Worker one when left out. */
  makeAi?: MakeAi;
  /** The game to play; the developer fixture when left out. */
  game?: VsAiGame;
};

/** The session for one game on this screen: the chosen game's rules, match and card names, or the fixture's. */
export function vsAiOptions(
  side: Side,
  {
    clock,
    newSeed,
    newAiSeed,
    makeAi = createWorkerAi,
    game,
  }: Readonly<Omit<VsAiScreenProps, "makeAi" | "game"> & { makeAi?: MakeAi | undefined; game?: VsAiGame | undefined }>,
): VsAiOptions {
  return {
    human: side,
    gameSeed: newSeed(),
    aiSeed: newAiSeed(),
    clock,
    makeAi,
    ...(game ? { ruleset: game.ruleset, makeMatch: game.makeMatch, label: game.cardName } : {}),
  };
}

export function VsAiScreen(props: Readonly<VsAiScreenProps>) {
  const { clock, newSeed, newAiSeed, makeAi, game } = props;
  const [side, setSide] = useState<Side | null>(null);
  const start = useCallback(
    () => createVsAiSession(vsAiOptions(side ?? "lio", { clock, newSeed, newAiSeed, makeAi, game })),
    [side, newSeed, newAiSeed, clock, makeAi, game],
  );
  if (!side) return <SidePicker onPick={setSide} note={game?.note} />;
  return <Playing start={start} onNewGame={() => setSide(null)} game={game} />;
}
