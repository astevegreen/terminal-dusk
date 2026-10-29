// Test mode (docs/architecture.md, Decision 3): the Local transport with a switch to view the game as LIO,
// as SAE or as a spectator. A developer tool, not the game's UI: it offers every choice and shows the refusal.
import type { Viewer } from "@terminal-dusk/engine";
import { useState, useSyncExternalStore } from "react";
import { GameScreen } from "../game/GameScreen.tsx";
import { ReplayScreen } from "../replay/ReplayScreen.tsx";
import type { ReplayRecording } from "../replay/recording.ts";
import { pointsOf } from "../displayText.ts";
import { cardAffiliation, cardName, cardQuestion, fixtureRuleset } from "./fixture.ts";
import { createTestSession } from "./session.ts";
import type { Snapshot, TestSession } from "./session.ts";

/** Each fixture card's points, shown on its chip in the hand strip (L6, #486). */
const cardPoints = pointsOf(fixtureRuleset);

const VIEWERS: readonly { viewer: Viewer; text: string }[] = [
  { viewer: "lio", text: "LIO" },
  { viewer: "sae", text: "SAE" },
  { viewer: "spectator", text: "Spectator" },
];
const TAP = { minHeight: 44, minWidth: 44 } as const;

/** The screen's two controls and the frame, drawn from a snapshot. */
export function TestModeView({ snapshot, session }: Readonly<{ snapshot: Snapshot; session: TestSession }>) {
  const [seedText, setSeedText] = useState(snapshot.seed);
  const [watching, setWatching] = useState<ReplayRecording | null>(null);
  const { frame, viewer } = snapshot;
  if (watching)
    return (
      <ReplayScreen
        recording={watching}
        label={cardName}
        question={cardQuestion}
        affiliation={cardAffiliation}
        onClose={() => setWatching(null)}
      />
    );
  return (
    <main className="game-page">
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
      {snapshot.replayReady && (
        <button type="button" style={TAP} onClick={() => setWatching(session.replay())}>
          Watch replay
        </button>
      )}
      <p data-testid="refusal" role="status">
        {snapshot.refusal ? `Refused: ${snapshot.refusal}` : "No refusal"}
      </p>
      {frame && (
        <GameScreen
          frame={frame}
          log={snapshot.log}
          era={snapshot.era}
          label={cardName}
          question={cardQuestion}
          affiliation={cardAffiliation}
          points={cardPoints}
          onAnswer={(value) => void session.answer(value)}
          refusal={snapshot.refusal}
        />
      )}
    </main>
  );
}

/** Starts a local match on mount and shows it. `clock` comes from main.tsx (hard rule 8). */
export function TestModeScreen({ clock }: Readonly<{ clock: () => number }>) {
  const [session] = useState(() => createTestSession(clock));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return <TestModeView snapshot={snapshot} session={session} />;
}
