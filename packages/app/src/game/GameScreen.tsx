// The game screen: one whole game drawn from one frame, laid out for a phone held sideways (844x390).
// It renders from its props alone. A placeholder look: boxes, no art, no colour scheme.
import type { AnswerValue, EraId } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { decisionPrompts } from "../decisionPrompts.tsx";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import "./gameScreen.css";
import { Contingency, Hand, Log, MapArea, Opponent, Region, StatusBar, Table } from "./regions.tsx";
import type { Label } from "./regions.tsx";
import type { CardRules } from "../displayText.ts";

export type GameScreenProps = {
  frame: Frame;
  /** Log lines, oldest first. */
  log: string[];
  /** The era of the latest eraStarted event the caller has seen, or null. */
  era: EraId | null;
  label: Label;
  /** A card's yes/no question, for the prompt. Display data only. */
  question: CardQuestion;
  /** Whose each card is, so the prompt offers only the plays a card allows. Display data only. */
  affiliation: CardAffiliation;
  /** A card's rules text, shown under its name in the hand; left out, the hand shows names only. Display data only. */
  rules?: CardRules | undefined;
  /** Present: the waiting decision can be answered. Absent: it is shown read-only. */
  onAnswer?: ((value: AnswerValue) => void) | undefined;
  refusal?: string | null | undefined;
};

function DecisionRegion({
  frame,
  label,
  question,
  affiliation,
  onAnswer,
  refusal,
}: Readonly<Omit<GameScreenProps, "log" | "era" | "rules">>) {
  const stack = frame.view.public.stack;
  const hand = frame.view.mine?.hand ?? [];
  const known = frame.view.mine?.knowledge ?? [];
  // The waiting decision is answerable; otherwise the open ones are shown read-only (a spectator's are always these).
  const waiting = frame.decision;
  const open = waiting ? [waiting] : frame.view.public.pending;
  return (
    <Region id="decision" title="Decision">
      {open.map((decision) => {
        const Prompt = decisionPrompts[decision.kind];
        const answer = waiting && onAnswer ? { onAnswer } : {};
        return (
          <Prompt
            key={decision.id}
            decision={decision}
            hand={hand}
            known={known}
            label={label}
            stack={stack}
            question={question}
            affiliation={affiliation}
            {...answer}
          />
        );
      })}
      {typeof refusal === "string" && <output role="alert">{`Refused: ${refusal}`}</output>}
    </Region>
  );
}

export function GameScreen({
  frame,
  log,
  era,
  label,
  question,
  affiliation,
  rules,
  onAnswer,
  refusal,
}: Readonly<GameScreenProps>) {
  return (
    // A game with no map gives its map box only its one line (gameScreen.css).
    <div className={frame.view.public.map === undefined ? "game game-no-map" : "game"}>
      <StatusBar frame={frame} era={era} />
      <MapArea frame={frame} />
      <Hand frame={frame} label={label} rules={rules} />
      {/* It scrolls, so the keyboard can reach it; a div with a role, as a section would pick up the boxed style. */}
      <div className="game-side" role="region" aria-label="Game details" tabIndex={0}>
        <Opponent frame={frame} />
        <Table pub={frame.view.public} label={label} />
        <Contingency pub={frame.view.public} />
        <DecisionRegion
          frame={frame}
          label={label}
          question={question}
          affiliation={affiliation}
          onAnswer={onAnswer}
          refusal={refusal}
        />
        <Log log={log} />
      </div>
    </div>
  );
}
