// The replay viewer: steps through a finished game's recorded frames, both hands showing. It shows what the
// recording holds and never runs the rules. A placeholder look, laid out like the game screen.
import { SIDES } from "@terminal-dusk/engine";
import type { CardId, EraId, GameStatus, Side } from "@terminal-dusk/engine";
import type { ReplayFrame } from "@terminal-dusk/host";
import { useState } from "react";
import { decisionPrompts } from "../decisionPrompts.tsx";
import { eraText, gameOverText, playsText } from "../displayText.ts";
import { logLine } from "../eventPresentation.ts";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import { Contingency, Log, Region, Table } from "../game/regions.tsx";
import type { Label } from "../game/regions.tsx";
import type { ReplayRecording } from "./recording.ts";
import "./replayScreen.css";

export type ReplayScreenProps = {
  recording: ReplayRecording;
  label: (card: CardId) => string;
  /** A card's yes/no question, for the read-only prompts. Display data only. */
  question: CardQuestion;
  affiliation: CardAffiliation;
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

const finalText = (status: GameStatus): string => (status.kind === "over" ? gameOverText(status) : "Game active");

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

function Hands({ frame, label }: Readonly<{ frame: ReplayFrame; label: Label }>) {
  return (
    <Region id="hands" title="Both hands" className="replay-hands">
      {SIDES.map((side: Side) => (
        <div key={side}>
          <h2>{`${side.toUpperCase()} hand`}</h2>
          <ol>
            {frame.view.sides[side].hand.map((card) => (
              <li key={card}>{label(card)}</li>
            ))}
          </ol>
        </div>
      ))}
    </Region>
  );
}

function OpenDecisions({
  frame,
  label,
  question,
  affiliation,
}: Readonly<{
  frame: ReplayFrame;
  label: Label;
  question: CardQuestion;
  affiliation: CardAffiliation;
}>) {
  const { pending, stack } = frame.view.public;
  return (
    <Region id="decision" title="Open decisions">
      {pending.map((decision) => {
        const Prompt = decisionPrompts[decision.kind];
        return (
          <Prompt
            key={decision.id}
            decision={decision}
            hand={[]}
            known={[]}
            label={label}
            stack={stack}
            question={question}
            affiliation={affiliation}
          />
        );
      })}
    </Region>
  );
}

/** The viewer at step `index` (counting from 0). It uses no state of its own, so a test can drive it. */
export function ReplayView({
  recording,
  label,
  question,
  affiliation,
  onClose,
  index,
  onGo,
}: Readonly<ReplayScreenProps & { index: number; onGo: (index: number) => void }>) {
  const { frames } = recording;
  const frame = frames[index];
  if (!frame) return <p role="alert">This replay has no frames.</p>;
  const pub = frame.view.public;
  const atLast = index === frames.length - 1;
  const log = frames
    .slice(0, index + 1)
    .flatMap((f) => f.events.map((event) => logLine(event, { card: label, era: eraText })));
  const era = eraAt(frames, index);
  return (
    <div className="replay">
      <Controls index={index} count={frames.length} onGo={onGo} onClose={onClose} />
      <Region id="status-bar" title="Status" className="replay-status">
        <span>{`Turn ${pub.turn} of ${pub.turns}`}</span>
        <span>{playsText(pub)}</span>
        <span>{era === null ? "Era not shown yet" : eraText(era)}</span>
        <span>{atLast ? finalText(recording.status) : "Game active"}</span>
        {atLast && <span>{`Seed checked: ${recording.seedHash}`}</span>}
      </Region>
      <Hands frame={frame} label={label} />
      <div className="replay-side">
        <Table pub={pub} label={label} />
        <Contingency pub={pub} />
        <OpenDecisions frame={frame} label={label} question={question} affiliation={affiliation} />
        <Log log={log} />
      </div>
    </div>
  );
}

export function ReplayScreen(props: Readonly<ReplayScreenProps>) {
  const [index, setIndex] = useState(0);
  return <ReplayView {...props} index={index} onGo={setIndex} />;
}
