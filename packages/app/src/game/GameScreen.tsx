// The game screen: one whole game drawn from one frame, laid out for a phone held sideways (844x390; L1, #464).
// Since L5 (#485) the map fills the whole screen and everything else floats over it: a slim see-through top bar
// and a sheet with the Play, Log and Details tabs (docs/design/screen-layout.md). Since L6 (#486) the hand is a slim
// strip along the bottom edge, with the sheet's tab row beside it; a card's choices are on the card when it is
// lifted. It renders from its props alone (SideTabs holds the picked tab, HandStrip the lifted card).
import type { AnswerValue, CardId, EraId } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import type { ReactNode } from "react";
import { decisionPrompts } from "../decisionPrompts.tsx";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import "./map/mapTheme.css";
import "./gameScreen.css";
import "./gameBars.css";
import "./handStrip.css";
import { LiftedCard, StripCounts, chipsOf } from "./handCards.tsx";
import { HandStrip } from "./handStrip.tsx";
import { Contingency, Log, MapArea, Opponent, Region, StatusBar, Table } from "./regions.tsx";
import type { Label } from "./regions.tsx";
import { SideTabs } from "./sideTabs.tsx";
import { Tracks } from "./tracks.tsx";
import type { CardPoints, CardRules } from "../displayText.ts";

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
  /** A card's rules text, shown on the card when it is lifted from the hand strip. Display data only. */
  rules?: CardRules | undefined;
  /** A card's points value, shown on its chip in the hand strip; left out, the chips show names only. Display data. */
  points?: CardPoints | undefined;
  /** Present: the waiting decision can be answered. Absent: it is shown read-only. */
  onAnswer?: ((value: AnswerValue) => void) | undefined;
  refusal?: string | null | undefined;
  /** What the page keeps out of the way, such as a note: a Menu at the start of the top bar holds it. */
  menu?: ReactNode;
  /** The page's own items for the top bar, such as Back or New game, shown after the Menu. */
  bar?: ReactNode;
};

type PromptData = Pick<GameScreenProps, "frame" | "label" | "question" | "affiliation">;

/** The props every prompt on the screen shares, from the frame and the display data. */
function shared({ frame, label, question, affiliation }: Readonly<PromptData>) {
  const hand = frame.view.mine?.hand ?? [];
  const known = frame.view.mine?.knowledge ?? [];
  return { hand, known, label, stack: frame.view.public.stack, question, affiliation };
}

/**
 * The decision's own region: its question, and the choices that use no card in the hand (those are on the lifted
 * card, L6). The waiting decision is answerable; otherwise the open ones are shown read-only (a spectator's are
 * always these). L7 (#487) turns this into the decision banner just above the hand strip.
 */
function DecisionRegion({
  onAnswer,
  refusal,
  ...data
}: Readonly<PromptData & Pick<GameScreenProps, "onAnswer" | "refusal">>) {
  const waiting = data.frame.decision;
  const open = waiting ? [waiting] : data.frame.view.public.pending;
  return (
    <Region id="decision" title="Decision">
      {open.map((decision) => {
        const Prompt = decisionPrompts[decision.kind];
        const answer = waiting && onAnswer ? { onAnswer } : {};
        return <Prompt key={decision.id} decision={decision} {...shared(data)} place="banner" {...answer} />;
      })}
      {typeof refusal === "string" && <output role="alert">{`Refused: ${refusal}`}</output>}
    </Region>
  );
}

/** The waiting decision's choices for one card, drawn on that card when it is lifted; nothing when none waits. */
function CardChoices({
  card,
  onAnswer,
  ...data
}: Readonly<PromptData & { card: CardId; onAnswer: GameScreenProps["onAnswer"] }>) {
  const waiting = data.frame.decision;
  if (!waiting || !onAnswer) return null;
  const Prompt = decisionPrompts[waiting.kind];
  return <Prompt decision={waiting} {...shared(data)} place={{ card }} onAnswer={onAnswer} />;
}

export function GameScreen({
  frame,
  log,
  era,
  label,
  question,
  affiliation,
  rules,
  points,
  onAnswer,
  refusal,
  menu,
  bar,
}: Readonly<GameScreenProps>) {
  const data = { frame, label, question, affiliation };
  const chips = chipsOf(frame.view.mine?.hand ?? [], label, points, affiliation);
  return (
    // A game with no map gives its map box only its one line (gameScreen.css).
    <div className={frame.view.public.map === undefined ? "game game-no-map" : "game"}>
      {/* Shown only on a screen taller than it is wide (gameScreen.css): the same layout, held the wrong way. */}
      <p className="game-rotate-hint">Turn your phone sideways to play.</p>
      <div className="game-top">
        {menu !== undefined && (
          <details className="game-menu">
            <summary>Menu</summary>
            <div className="game-menu-body">{menu}</div>
          </details>
        )}
        {bar}
        <div className="game-top-main">
          <StatusBar frame={frame} era={era} />
          <Tracks pub={frame.view.public} />
        </div>
      </div>
      <MapArea frame={frame} />
      {/* The bottom edge: the hand strip, then the sheet's tab row, whose open panel rises over the map. */}
      <div className="game-bottom">
        <HandStrip chips={chips} counts={<StripCounts frame={frame} />}>
          {chips.map((chip) => (
            <LiftedCard key={chip.card} chip={chip} rules={rules}>
              <CardChoices card={chip.card} onAnswer={onAnswer} {...data} />
            </LiftedCard>
          ))}
        </HandStrip>
        {/* A div with a role, as a section would pick up the boxed style. Its tabs are Play, Log and Details. */}
        <div className="game-sheet" role="region" aria-label="Game details" tabIndex={0}>
          <SideTabs waitingId={frame.decision?.id ?? null}>
            <DecisionRegion onAnswer={onAnswer} refusal={refusal} {...data} />
            <Log log={log} />
            <>
              <Opponent frame={frame} />
              <Table pub={frame.view.public} label={label} />
              <Contingency pub={frame.view.public} />
            </>
          </SideTabs>
        </div>
      </div>
    </div>
  );
}
