// Test mode (docs/architecture.md, Decision 3): the Local transport with a switch to view the game as LIO,
// as SAE or as a spectator. A developer tool, not the game's UI: it offers every choice and shows the refusal.
import { SIDES } from "@terminal-dusk/engine";
import type { CardId, Viewer } from "@terminal-dusk/engine";
import { useState, useSyncExternalStore } from "react";
import { decisionPrompts } from "../decisionPrompts.tsx";
import { cardName } from "./fixture.ts";
import { createTestSession } from "./session.ts";
import type { Snapshot, TestSession } from "./session.ts";

const VIEWERS: readonly { viewer: Viewer; text: string }[] = [
  { viewer: "lio", text: "LIO" },
  { viewer: "sae", text: "SAE" },
  { viewer: "spectator", text: "Spectator" },
];
const TAP = { minHeight: 44, minWidth: 44 } as const;
const names = (cards: CardId[]): string => (cards.length === 0 ? "none" : cards.map(cardName).join(", "));

/** The screen's two controls and the frame, drawn from a snapshot. */
export function TestModeView({ snapshot, session }: Readonly<{ snapshot: Snapshot; session: TestSession }>) {
  const [seedText, setSeedText] = useState(snapshot.seed);
  const { frame, viewer } = snapshot;
  const pub = frame?.view.public;
  const hand = frame?.view.mine?.hand ?? [];
  // The waiting decision is answerable; otherwise the open ones are shown read-only (a spectator's are always these).
  const answerable = frame?.decision ?? null;
  const readOnly = answerable ? [] : (pub?.pending ?? []);

  return (
    <main>
      <h1>Test mode</h1>
      <nav aria-label="Viewer">
        {VIEWERS.map(({ viewer: v, text }) => (
          <button key={v} type="button" style={TAP} aria-pressed={v === viewer} onClick={() => session.setViewer(v)}>
            {text}
          </button>
        ))}
      </nav>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          session.restart(seedText);
        }}
      >
        <label>
          Seed <input value={seedText} style={{ minHeight: 44 }} onChange={(e) => setSeedText(e.target.value)} />
        </label>
        <button type="submit" style={TAP}>
          Restart
        </button>
      </form>
      <p data-testid="refusal" role="status">
        {snapshot.refusal ? `Refused: ${snapshot.refusal}` : "No refusal"}
      </p>
      {frame && pub && (
        <>
          <p data-testid="game-status">
            {pub.status.kind === "active"
              ? "Game active"
              : `Game over: ${pub.status.winner ?? "no winner"}, ${pub.status.reason}`}
          </p>
          <p data-testid="progress">{`Viewing as ${viewer}. Turn ${pub.turn} of ${pub.turns}. Plays made: ${pub.playsMade} of ${2 * pub.playsPerTurn}. Step ${frame.seq}.`}</p>
          <p data-testid="in-play">{`In play: ${names(pub.inPlay)}`}</p>
          <p data-testid="discard">{`Discard pile: ${names(pub.discard)}`}</p>
          {frame.view.mine ? (
            <>
              <p data-testid="hand">{`Your hand: ${names(hand)}`}</p>
              {SIDES.filter((s) => s !== viewer).map((s) => (
                <p key={s}>{`${s} hand: ${frame.view.counts.hands[s]} cards`}</p>
              ))}
            </>
          ) : (
            <p data-testid="hand">{`Hands: ${SIDES.map((s) => `${s} ${frame.view.counts.hands[s]} cards`).join(", ")}`}</p>
          )}
          {answerable &&
            (() => {
              const Prompt = decisionPrompts[answerable.kind];
              return (
                <Prompt
                  decision={answerable}
                  hand={hand}
                  label={cardName}
                  onAnswer={(value) => void session.answer(value)}
                />
              );
            })()}
          {readOnly.map((decision) => {
            const Prompt = decisionPrompts[decision.kind];
            return <Prompt key={decision.id} decision={decision} hand={hand} label={cardName} />;
          })}
        </>
      )}
      <h2>Game log</h2>
      <ol data-testid="log">
        {snapshot.log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </main>
  );
}

/** Starts a local match on mount and shows it. `clock` comes from main.tsx (hard rule 8). */
export function TestModeScreen({ clock }: Readonly<{ clock: () => number }>) {
  const [session] = useState(() => createTestSession(clock));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return <TestModeView snapshot={snapshot} session={session} />;
}
