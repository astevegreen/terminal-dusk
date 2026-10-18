// The game screen: one whole game drawn from one frame, laid out for a phone held sideways (844x390).
// It renders from its props alone. A placeholder look: boxes, no art, no colour scheme.
import type { AnswerValue, EraId } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { decisionPrompts } from "../decisionPrompts.tsx";
import "./gameScreen.css";
import { Contingency, Hand, Log, MapArea, Opponent, Region, StatusBar, Table } from "./regions.tsx";
import type { Label } from "./regions.tsx";

export type GameScreenProps = {
  frame: Frame;
  /** Log lines, oldest first. */
  log: string[];
  /** The era of the latest eraStarted event the caller has seen, or null. */
  era: EraId | null;
  label: Label;
  /** Present: the waiting decision can be answered. Absent: it is shown read-only. */
  onAnswer?: ((value: AnswerValue) => void) | undefined;
  refusal?: string | null | undefined;
};

function DecisionRegion({ frame, label, onAnswer, refusal }: Readonly<Omit<GameScreenProps, "log" | "era">>) {
  const hand = frame.view.mine?.hand ?? [];
  // The waiting decision is answerable; otherwise the open ones are shown read-only (a spectator's are always these).
  const waiting = frame.decision;
  const Waiting = waiting ? decisionPrompts[waiting.kind] : null;
  const readOnly = waiting ? [] : frame.view.public.pending;
  return (
    <Region id="decision" title="Decision">
      {waiting && Waiting && (
        <Waiting decision={waiting} hand={hand} label={label} {...(onAnswer ? { onAnswer } : {})} />
      )}
      {readOnly.map((decision) => {
        const Prompt = decisionPrompts[decision.kind];
        return <Prompt key={decision.id} decision={decision} hand={hand} label={label} />;
      })}
      {typeof refusal === "string" && <p role="status">{`Refused: ${refusal}`}</p>}
    </Region>
  );
}

export function GameScreen({ frame, log, era, label, onAnswer, refusal }: Readonly<GameScreenProps>) {
  return (
    <div className="game">
      <StatusBar frame={frame} era={era} />
      <MapArea />
      <Hand frame={frame} label={label} />
      <div className="game-side">
        <Opponent frame={frame} />
        <Table frame={frame} label={label} />
        <Contingency frame={frame} />
        <DecisionRegion frame={frame} label={label} onAnswer={onAnswer} refusal={refusal} />
        <Log log={log} />
      </div>
    </div>
  );
}
