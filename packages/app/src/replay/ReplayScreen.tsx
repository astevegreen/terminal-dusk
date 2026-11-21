// The replay viewer: steps through a finished game's recorded frames, both hands showing. It shows what the
// recording holds and never runs the rules. Since #493 it is the game screen itself (GameScreen), as a spectator
// sees it: the drawn map fills the screen with each step's influence and lights the countries that step touched,
// the replay controls and its own status lines sit in the top bar, and both hands are in the Details panel.
import { SIDES } from "@terminal-dusk/engine";
import type { CardId, EraId, Side } from "@terminal-dusk/engine";
import type { Frame, ReplayFrame } from "@terminal-dusk/host";
import { useState } from "react";
import { eraText, gameOverText, mapNames } from "../displayText.ts";
import { logLine } from "../eventPresentation.ts";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import type { CardRules } from "../displayText.ts";
import { GameScreen } from "../game/GameScreen.tsx";
import { HandCard, Region } from "../game/regions.tsx";
import type { Label } from "../game/regions.tsx";
import type { ReplayRecording } from "./recording.ts";
import { difficultyText } from "../vsAi/difficulty.tsx";
import "./replayScreen.css";

export type ReplayScreenProps = {
  recording: ReplayRecording;
  label: (card: CardId) => string;
  /** A card's yes/no question, for the read-only prompts. Display data only. */
  question: CardQuestion;
  affiliation: CardAffiliation;
  /** A card's rules text, shown under its name in both hands; left out, the hands show names only. */
  rules?: CardRules | undefined;
  onClose: () => void;
};

const TAP = { minHeight: 44, minWidth: 44 } as const;

/** The era of the latest eraStarted event in the frames up to and including `index`, or null. */
function eraAt(frames: readonly ReplayFrame[], index: number): EraId | null {
  for (let i = index; i >= 0; i--) {
    for (const event of frames[i]!.events.toReversed()) if (event.kind === "eraStarted") return event.era;
  }
  return null;
}

/**
 * One recorded step as a spectator's frame, so the game screen draws it: the public state, the counts and that
 * step's events (which light the countries it touched). No hand of its own and no decision to answer; both hands
 * are shown apart, in the Details panel, exactly as the recording holds them.
 */
export function spectatorFrame(recording: ReplayRecording, frame: ReplayFrame): Frame {
  const { public: pub, counts, meta } = frame.view;
  return {
    matchId: recording.matchId,
    seq: frame.seq,
    viewer: "spectator",
    ruleset: meta.ruleset,
    view: { public: pub, mine: null, counts, meta },
    events: frame.events,
    decision: null,
  };
}

function Controls({
  index,
  count,
  onGo,
  onClose,
}: Readonly<{ index: number; count: number; onGo: (index: number) => void; onClose: () => void }>) {
  const first = index === 0;
  const last = index === count - 1;
  return (
    <nav aria-label="Replay controls" className="replay-controls">
      <button type="button" style={TAP} disabled={first} onClick={() => onGo(0)}>
        First
      </button>
      <button type="button" style={TAP} disabled={first} onClick={() => onGo(index - 1)}>
        Back
      </button>
      <span>{`Step ${index + 1} of ${count}`}</span>
      <button type="button" style={TAP} disabled={last} onClick={() => onGo(index + 1)}>
        Next
      </button>
      <button type="button" style={TAP} disabled={last} onClick={() => onGo(count - 1)}>
        Last
      </button>
      <button type="button" style={TAP} onClick={onClose}>
        Close
      </button>
    </nav>
  );
}

function Hands({ frame, label, rules }: Readonly<{ frame: ReplayFrame; label: Label; rules: CardRules | undefined }>) {
  return (
    <Region id="hands" title="Both hands" className="replay-hands">
      {SIDES.map((side: Side) => (
        <div key={side}>
          <h2>{`${side.toUpperCase()} hand`}</h2>
          <ol>
            {frame.view.sides[side].hand.map((card) => (
              <HandCard key={card} card={card} label={label} rules={rules} />
            ))}
          </ol>
        </div>
      ))}
    </Region>
  );
}

/** The viewer at step `index` (counting from 0). It uses no state of its own, so a test can drive it. */
export function ReplayView({
  recording,
  label,
  question,
  affiliation,
  rules,
  onClose,
  index,
  onGo,
}: Readonly<ReplayScreenProps & { index: number; onGo: (index: number) => void }>) {
  const { frames } = recording;
  const frame = frames[index];
  if (!frame) return <p role="alert">This replay has no frames.</p>;
  const atLast = index === frames.length - 1;
  const log = frames
    .slice(0, index + 1)
    .flatMap((f) => f.events.map((event) => logLine(event, { card: label, era: eraText, ...mapNames(f.view.public) })));
  // Cut short with "…" in the top bar on a phone; the Details panel holds it, and the game's result, in full. The AI's difficulty is in the
  // Details panel's head, as in the game (#508), so the bar keeps its room for the status and the end of the game.
  const seed = `Seed checked: ${recording.seedHash}`;
  const bar = (
    <>
      <Controls index={index} count={frames.length} onGo={onGo} onClose={onClose} />
      {atLast && <p>{seed}</p>}
    </>
  );
  return (
    <main className="game-page replay">
      <GameScreen
        frame={spectatorFrame(recording, frame)}
        log={log}
        era={eraAt(frames, index)}
        label={label}
        question={question}
        affiliation={affiliation}
        rules={rules}
        onAnswer={undefined}
        refusal={null}
        bar={bar}
        {...(recording.aiTier === undefined ? {} : { detailsNote: difficultyText(recording.aiTier) })}
        extraDetails={
          <>
            {atLast && recording.status.kind === "over" && <p>{gameOverText(recording.status)}</p>}
            {atLast && <p>{seed}</p>}
            <Hands frame={frame} label={label} rules={rules} />
          </>
        }
      />
    </main>
  );
}

export function ReplayScreen(props: Readonly<ReplayScreenProps>) {
  const [index, setIndex] = useState(0);
  return <ReplayView {...props} index={index} onGo={setIndex} />;
}
