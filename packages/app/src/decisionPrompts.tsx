// One prompt component per DecisionKind. A new kind without an entry here fails the type check (hard rule 9).
// The prompts only list what a decision asks. They do not work out what is legal: an illegal pick is
// refused by the transport and the screen shows the refusal (.claude/rules/app.md, no rules logic).
// The play prompt sorts each card into own, rival or neutral by its affiliation and the deciding side (the same
// sort as whoseCard in the engine's decisions.ts), then takes the uses allowed for that kind from the decision.
import type {
  AnswerValue,
  CardId,
  Decision,
  PlayUse,
  PointsAction,
  DecisionKind,
  Frame as StackFrame,
  Side,
} from "@terminal-dusk/engine";
import type { ComponentType } from "react";
import { SIDE_NAME } from "./displayText.ts";

/** A card's yes/no question, from its rules text, or undefined when it has none. Display data only. */
export type CardQuestion = (card: CardId) => string | undefined;

/** Whose card it is ("lio", "sae" or "neutral"), or undefined for an unknown card. Display data only. */
export type CardAffiliation = (card: CardId) => Side | "neutral" | undefined;

export type PromptProps = {
  decision: Decision;
  /** The viewer's hand, card ids from its frame (empty for a spectator). */
  hand: CardId[];
  /** The rival's cards the viewer has been shown: its knowledge, from its frame (empty for a spectator or a replay). */
  known: CardId[];
  /** A card's display name. Display data only. */
  label: (card: CardId) => string;
  /** A card's affiliation, to offer each card only the plays its kind allows. Display data only. */
  affiliation: CardAffiliation;
  /** The public resolution stack from the frame, bottom first: it shows which card's effect is asking. */
  stack: readonly StackFrame[];
  question: CardQuestion;
  /** Present: the prompt shows a button per choice. Absent: it is read-only, with the choices as text. */
  onAnswer?: (value: AnswerValue) => void;
};
export type PromptComponent = ComponentType<PromptProps>;

/** The smallest tap target (.claude/rules/app.md). */
const BUTTON_STYLE = { minHeight: 44, minWidth: 44 } as const;
const USES: readonly PlayUse[] = ["event", "points"];

type Choice = { text: string; value: AnswerValue };

/**
 * The choices as a list of button texts and the answers they send, in a group named by its question.
 * The question's id comes from the decision's id (no useId: tests call prompts as plain functions), so two
 * prompts on one screen get different ids.
 */
function Choices({
  decision,
  question,
  choices,
  onAnswer,
}: Readonly<{ decision: Decision; question: string; choices: Choice[]; onAnswer?: PromptProps["onAnswer"] }>) {
  const questionId = `decision-${decision.id}-question`;
  return (
    <section role="group" aria-labelledby={questionId}>
      <p id={questionId}>{question}</p>
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

/** The card whose effect is running: the source of the nearest program frame from the top, if it has one. */
export function askingCard(stack: readonly StackFrame[]): CardId | undefined {
  const program = stack.findLast((frame) => frame.kind === "program");
  return program?.kind === "program" ? program.source : undefined;
}

/** "<side>, <card name>: <question>" when the asking card has a question; "<side>: yes or no?" otherwise. */
function yesNoText({ decision, label, stack, question }: Readonly<PromptProps>): string {
  const card = askingCard(stack);
  const asked = card === undefined ? undefined : question(card);
  return card === undefined || asked === undefined
    ? `${SIDE_NAME[decision.side]}: yes or no?`
    : `${SIDE_NAME[decision.side]}, ${label(card)}: ${asked}`;
}

function YesNoPrompt(props: Readonly<PromptProps>) {
  const choices: Choice[] = [
    { text: "Yes", value: { kind: "yesNo", yes: true } },
    { text: "No", value: { kind: "yesNo", yes: false } },
  ];
  return <Choices decision={props.decision} question={yesNoText(props)} choices={choices} onAnswer={props.onAnswer} />;
}

/** The secret opening card pick: every card in the hand. */
function ChooseCardPrompt({ decision, hand, label, onAnswer }: Readonly<PromptProps>) {
  const choices: Choice[] = hand.map((card) => ({ text: label(card), value: { kind: "chooseCard", card } }));
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: pick an opening card`}
      choices={choices}
      onAnswer={onAnswer}
    />
  );
}

/**
 * Whose card this is from the deciding side's seat, which picks the decision's list of uses for it. A card
 * whose affiliation is unknown counts as neutral, as in the engine. The uses themselves come from the decision.
 */
function kindOf(card: CardId, side: Side, affiliation: CardAffiliation): "own" | "rival" | "neutral" {
  const owner = affiliation(card);
  if (owner === undefined || owner === "neutral") return "neutral";
  return owner === side ? "own" : "rival";
}

/** A play: every card in the hand, with the uses the decision allows for that card's kind. */
function PlayCardAsPrompt({ decision, hand, label, affiliation, onAnswer }: Readonly<PromptProps>) {
  const options = decision.options;
  const choices: Choice[] = hand.flatMap((card) => {
    const allowed: ReadonlySet<PlayUse> =
      "uses" in options ? new Set(options.uses[kindOf(card, decision.side, affiliation)]) : new Set<PlayUse>();
    return USES.filter((use) => allowed.has(use)).map((as): Choice => ({
      text: `${label(card)}: ${as}`,
      value: { kind: "playCardAs", card, as },
    }));
  });
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: play a card for its event or its points`}
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
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: the rival's event happens before or after your points?`}
      choices={choices}
      onAnswer={onAnswer}
    />
  );
}

/** Every set of `count` cards from `cards`, each in the list's order, the sets in order of position. */
function setsOf(cards: readonly CardId[], count: number): CardId[][] {
  if (count <= 0) return [[]];
  return cards.flatMap((card, i) => setsOf(cards.slice(i + 1), count - 1).map((rest) => [card, ...rest]));
}

/**
 * A discard pick: one choice per set of `count` cards, from the viewer's hand ("hand") or the rival's cards it
 * has been shown ("rivalHand"), labelled with the card names.
 */
function DiscardCardsPrompt({ decision, hand, known, label, onAnswer }: Readonly<PromptProps>) {
  const options = decision.options;
  const from = "from" in options ? options.from : "hand";
  const count = "count" in options ? options.count : 0;
  const cards = from === "rivalHand" ? known : hand;
  const choices: Choice[] = setsOf(cards, count).map((set) => ({
    text: `Discard ${set.map(label).join(", ")}`,
    value: { kind: "discardCards", cards: set },
  }));
  const whose = from === "rivalHand" ? "the rival's hand" : "your hand";
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: discard ${count} card${count === 1 ? "" : "s"} from ${whose}`}
      choices={choices}
      onAnswer={onAnswer}
    />
  );
}

/**
 * A placing (R16a): one choice per country the decision lists, in its order, with the points left in the
 * question. A country the side cannot afford now is refused by the transport, like any illegal pick.
 */
function PlaceInfluencePrompt({ decision, onAnswer }: Readonly<PromptProps>) {
  const options = decision.options;
  const points = "points" in options ? options.points : 0;
  const countries = "countries" in options ? options.countries : [];
  const choices: Choice[] = countries.map((country) => ({
    text: `Place in ${country}`,
    value: { kind: "placeInfluence", country },
  }));
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: place 1 influence (${points} point${points === 1 ? "" : "s"} left)`}
      choices={choices}
      onAnswer={onAnswer}
    />
  );
}

const ACTION_TEXT: Record<Exclude<PointsAction, "intervene">, string> = {
  place: "Place influence",
  realign: "Realign",
  pass: "Leave the points unspent",
};

/**
 * The action menu (R16b, R16c): all the points go to one action. One choice per action the decision lists, in its
 * order, except an intervention, which is one choice per country the decision lists for it.
 */
function ChooseActionPrompt({ decision, onAnswer }: Readonly<PromptProps>) {
  const options = decision.options;
  const points = "actions" in options ? options.points : 0;
  const actions = "actions" in options ? options.actions : [];
  const targets = "actions" in options ? options.targets : [];
  const choices: Choice[] = actions.flatMap((action): Choice[] =>
    action === "intervene"
      ? targets.map((country) => ({
          text: `Intervene in ${country}`,
          value: { kind: "chooseAction", action, country },
        }))
      : [{ text: ACTION_TEXT[action], value: { kind: "chooseAction", action } }],
  );
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: spend all ${points} point${points === 1 ? "" : "s"} on one action`}
      choices={choices}
      onAnswer={onAnswer}
    />
  );
}

/**
 * A realignment attempt (R16c): one choice per country the decision lists, then a choice to stop (the attempts
 * left unmade), with the attempts left in the question.
 */
function RealignPrompt({ decision, onAnswer }: Readonly<PromptProps>) {
  const options = decision.options;
  const attempts = "attempts" in options ? options.attempts : 0;
  const targets = "attempts" in options ? options.targets : [];
  const choices: Choice[] = [
    ...targets.map((country): Choice => ({ text: `Realign in ${country}`, value: { kind: "realign", country } })),
    { text: "Stop realigning", value: { kind: "realign", country: null } },
  ];
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: realign (${attempts} attempt${attempts === 1 ? "" : "s"} left)`}
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
  discardCards: DiscardCardsPrompt,
  placeInfluence: PlaceInfluencePrompt,
  chooseAction: ChooseActionPrompt,
  realign: RealignPrompt,
};
