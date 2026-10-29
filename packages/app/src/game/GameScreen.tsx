// The game screen: one whole game drawn from one frame, laid out for a phone held sideways (844x390; L1, #464).
// Since L5 (#485) the map fills the whole screen and everything else floats over it: a slim see-through top bar,
// the ticker under it with the log drawer it opens (L9, #489), and a sheet along the bottom with the Play and
// Details tabs (docs/design/screen-layout.md). It renders from its props alone (SideTabs holds the picked tab,
// LogDrawer whether the drawer is open).
import type { AnswerValue, EraId } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import type { ReactNode } from "react";
import { decisionPrompts } from "../decisionPrompts.tsx";
import type { CardAffiliation, CardQuestion } from "../decisionPrompts.tsx";
import "./map/mapTheme.css";
import "./gameScreen.css";
import "./gameBars.css";
import { LogDrawer } from "./logDrawer.tsx";
import { Contingency, Hand, MapArea, Opponent, Region, StatusBar, Table } from "./regions.tsx";
import type { Label } from "./regions.tsx";
import { SideTabs } from "./sideTabs.tsx";
import { Tracks } from "./tracks.tsx";
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
  /** What the page keeps out of the way, such as a note: a Menu at the start of the top bar holds it. */
  menu?: ReactNode;
  /** The page's own items for the top bar, such as Back or New game, shown after the Menu. */
  bar?: ReactNode;
};

function DecisionRegion({
  frame,
  label,
  question,
  affiliation,
  onAnswer,
  refusal,
}: Readonly<Omit<GameScreenProps, "log" | "era" | "rules" | "menu" | "bar">>) {
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
  menu,
  bar,
}: Readonly<GameScreenProps>) {
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
      <LogDrawer log={log} waitingId={frame.decision?.id ?? null} />
      <MapArea frame={frame} />
      {/* A div with a role, as a section would pick up the boxed style. Its tabs are Play and Details. */}
      <div className="game-sheet" role="region" aria-label="Game details" tabIndex={0}>
        <SideTabs waitingId={frame.decision?.id ?? null}>
          <>
            <DecisionRegion
              frame={frame}
              label={label}
              question={question}
              affiliation={affiliation}
              onAnswer={onAnswer}
              refusal={refusal}
            />
            <Hand frame={frame} label={label} rules={rules} />
          </>
          <>
            <Opponent frame={frame} />
            <Table pub={frame.view.public} label={label} />
            <Contingency pub={frame.view.public} />
          </>
        </SideTabs>
      </div>
    </div>
  );
}
