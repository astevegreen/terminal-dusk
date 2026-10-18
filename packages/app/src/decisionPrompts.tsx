// One prompt component per DecisionKind. A new kind without an entry here fails the type check (hard rule 9).
// The prompts only list what a decision asks. They do not work out what is legal: an illegal pick is
// refused by the transport and the screen shows the refusal (.claude/rules/app.md, no rules logic).
import type { AnswerValue, CardId, Decision, PlayUse, DecisionKind } from "@terminal-dusk/engine";
import type { ComponentType } from "react";

export type PromptProps = {
  decision: Decision;
  /** The viewer's hand, card ids from its frame (empty for a spectator). */
  hand: CardId[];
  /** A card's display name. Display data only. */
  label: (card: CardId) => string;
  /** Present: the prompt shows a button per choice. Absent: it is read-only, with the choices as text. */
  onAnswer?: (value: AnswerValue) => void;
};
export type PromptComponent = ComponentType<PromptProps>;

/** The smallest tap target (.claude/rules/app.md). */
const BUTTON_STYLE = { minHeight: 44, minWidth: 44 } as const;
const USES: readonly PlayUse[] = ["event", "points"];

type Choice = { text: string; value: AnswerValue };

/** The choices as a list of button texts and the answers they send. */
function Choices({
  question,
  choices,
  onAnswer,
}: Readonly<{ question: string; choices: Choice[]; onAnswer?: PromptProps["onAnswer"] }>) {
  return (
    <section>
      <p>{question}</p>
      {onAnswer ? (
        <div>
          {choices.map((choice) => (
            <button key={choice.text} type="button" style={BUTTON_STYLE} onClick={() => onAnswer(choice.value)}>
              {choice.text}
            </button>
          ))}
        </div>
      ) : (
        <ul>
          {choices.map((choice) => (
            <li key={choice.text}>{choice.text}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function YesNoPrompt({ decision, onAnswer }: Readonly<PromptProps>) {
  const choices: Choice[] = [
    { text: "Yes", value: { kind: "yesNo", yes: true } },
    { text: "No", value: { kind: "yesNo", yes: false } },
  ];
  return <Choices question={`${decision.side}: yes or no?`} choices={choices} onAnswer={onAnswer} />;
}

/** The secret opening card pick: every card in the hand. */
function ChooseCardPrompt({ decision, hand, label, onAnswer }: Readonly<PromptProps>) {
  const choices: Choice[] = hand.map((card) => ({ text: label(card), value: { kind: "chooseCard", card } }));
  return <Choices question={`${decision.side}: pick an opening card`} choices={choices} onAnswer={onAnswer} />;
}

/** A play: every card in the hand, with every use that any kind of card is allowed. */
function PlayCardAsPrompt({ decision, hand, label, onAnswer }: Readonly<PromptProps>) {
  const options = decision.options;
  const allowed =
    "uses" in options
      ? new Set([...options.uses.own, ...options.uses.rival, ...options.uses.neutral])
      : new Set<PlayUse>();
  const choices: Choice[] = hand.flatMap((card) =>
    USES.filter((use) => allowed.has(use)).map((as): Choice => ({
      text: `${label(card)}: ${as}`,
      value: { kind: "playCardAs", card, as },
    })),
  );
  return (
    <Choices
      question={`${decision.side}: play a card for its event or its points`}
      choices={choices}
      onAnswer={onAnswer}
    />
  );
}

function RivalEventOrderPrompt({ decision, onAnswer }: Readonly<PromptProps>) {
  const choices: Choice[] = [
    { text: "Before the points", value: { kind: "rivalEventOrder", event: "before" } },
    { text: "After the points", value: { kind: "rivalEventOrder", event: "after" } },
  ];
  return (
    <Choices
      question={`${decision.side}: the rival's event happens before or after your points?`}
      choices={choices}
      onAnswer={onAnswer}
    />
  );
}

export const decisionPrompts: Record<DecisionKind, PromptComponent> = {
  yesNo: YesNoPrompt,
  chooseCard: ChooseCardPrompt,
  playCardAs: PlayCardAsPrompt,
  rivalEventOrder: RivalEventOrderPrompt,
};
