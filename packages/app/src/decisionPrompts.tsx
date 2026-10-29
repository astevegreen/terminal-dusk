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
import { countryChoices } from "./countryChoices.ts";
import type { CountryName } from "./countryChoices.ts";
import { SIDE_NAME } from "./displayText.ts";
import { Choices } from "./promptChoices.tsx";
import type { Choice, PromptPlace } from "./promptChoices.tsx";

export type { PromptPlace } from "./promptChoices.tsx";

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
  /** A country's name, from the frame's public map (countryChoices.ts), so no choice shows a country's id. */
  country: CountryName;
  /** A card's affiliation, to offer each card only the plays its kind allows. Display data only. */
  affiliation: CardAffiliation;
  /** The public resolution stack from the frame, bottom first: it shows which card's effect is asking. */
  stack: readonly StackFrame[];
  question: CardQuestion;
  /** Present: the prompt shows a button per choice. Absent: it is read-only, with the choices as text. */
  onAnswer?: (value: AnswerValue) => void;
  /** Where this drawing of the prompt is (promptChoices.tsx); left out, every choice is drawn here. */
  place?: PromptPlace | undefined;
};
export type PromptComponent = ComponentType<PromptProps>;

const USES: readonly PlayUse[] = ["event", "points"];

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
  return (
    <Choices
      decision={props.decision}
      question={yesNoText(props)}
      choices={choices}
      onAnswer={props.onAnswer}
      place={props.place}
    />
  );
}

/** The secret opening card pick: every card in the hand. */
function ChooseCardPrompt({ decision, hand, label, onAnswer, place }: Readonly<PromptProps>) {
  const choices: Choice[] = hand.map((card) => ({
    text: label(card),
    value: { kind: "chooseCard", card },
    cards: [card],
  }));
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: pick an opening card`}
      choices={choices}
      onAnswer={onAnswer}
      place={place}
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

/** Every card in the hand, with the uses the decision allows for that card's kind. */
function playChoices({ decision, hand, label, affiliation }: Readonly<PromptProps>): Choice[] {
  const options = decision.options;
  return hand.flatMap((card) => {
    const allowed: ReadonlySet<PlayUse> =
      "uses" in options ? new Set(options.uses[kindOf(card, decision.side, affiliation)]) : new Set<PlayUse>();
    return USES.filter((use) => allowed.has(use)).map((as): Choice => ({
      text: `${label(card)}: ${as}`,
      value: { kind: "playCardAs", card, as },
      cards: [card],
    }));
  });
}

/** A play: every card in the hand, with the uses the decision allows for that card's kind. */
function PlayCardAsPrompt(props: Readonly<PromptProps>) {
  return (
    <Choices
      decision={props.decision}
      question={`${SIDE_NAME[props.decision.side]}: play a card for its event or its points`}
      choices={playChoices(props)}
      onAnswer={props.onAnswer}
      place={props.place}
    />
  );
}

/** Hypersonics' extra play at the end of the turn: a play as above, or passing. */
function ExtraPlayPrompt(props: Readonly<PromptProps>) {
  const choices: Choice[] = [...playChoices(props), { text: "Pass", value: { kind: "pass" } }];
  return (
    <Choices
      decision={props.decision}
      question={`${SIDE_NAME[props.decision.side]}: Hypersonics extra play, or pass`}
      choices={choices}
      onAnswer={props.onAnswer}
      place={props.place}
    />
  );
}

function RivalEventOrderPrompt({ decision, onAnswer, place }: Readonly<PromptProps>) {
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
      place={place}
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
function DiscardCardsPrompt({ decision, hand, known, label, onAnswer, place }: Readonly<PromptProps>) {
  const options = decision.options;
  const from = "from" in options ? options.from : "hand";
  const count = "count" in options ? options.count : 0;
  const cards = from === "rivalHand" ? known : hand;
  // From the hand, each set goes on the lifted card of every card in it; the rival's cards are not in the strip.
  const choices: Choice[] = setsOf(cards, count).map((set) => ({
    text: `Discard ${set.map(label).join(", ")}`,
    value: { kind: "discardCards", cards: set },
    ...(from === "hand" ? { cards: set } : {}),
  }));
  const whose = from === "rivalHand" ? "the rival's hand" : "your hand";
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: discard ${count} card${count === 1 ? "" : "s"} from ${whose}`}
      choices={choices}
      onAnswer={onAnswer}
      place={place}
    />
  );
}

/**
 * A placing (R16a): one choice per country the decision lists, in its order, with the points left in the
 * question. A country the side cannot afford now is refused by the transport, like any illegal pick.
 */
function PlaceInfluencePrompt({ decision, country, onAnswer, place }: Readonly<PromptProps>) {
  const options = decision.options;
  const points = "points" in options ? options.points : 0;
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: place 1 influence (${points} point${points === 1 ? "" : "s"} left)`}
      choices={countryChoices(decision, country)}
      onAnswer={onAnswer}
      place={place}
    />
  );
}

const ACTION_TEXT: Record<Exclude<PointsAction, "intervene">, string> = {
  place: "Place influence",
  realign: "Realign",
  techRace: "Make a tech race attempt",
  pass: "Leave the points unspent",
};

/**
 * The action menu (R16b, R16c): all the points go to one action. One choice per action the decision lists, in its
 * order, except an intervention, which is one choice per country the decision lists for it.
 */
function ChooseActionPrompt({ decision, country, onAnswer, place }: Readonly<PromptProps>) {
  const options = decision.options;
  const points = "actions" in options ? options.points : 0;
  const actions = "actions" in options ? options.actions : [];
  const choices: Choice[] = actions.flatMap((action): Choice[] =>
    action === "intervene"
      ? countryChoices(decision, country)
      : [{ text: ACTION_TEXT[action], value: { kind: "chooseAction", action } }],
  );
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: spend all ${points} point${points === 1 ? "" : "s"} on one action`}
      choices={choices}
      onAnswer={onAnswer}
      place={place}
    />
  );
}

/**
 * A realignment attempt (R16c): one choice per country the decision lists, then a choice to stop (the attempts
 * left unmade), with the attempts left in the question.
 */
function RealignPrompt({ decision, country, onAnswer, place }: Readonly<PromptProps>) {
  const options = decision.options;
  const attempts = "attempts" in options ? options.attempts : 0;
  const choices: Choice[] = [
    ...countryChoices(decision, country),
    { text: "Stop realigning", value: { kind: "realign", country: null } },
  ];
  return (
    <Choices
      decision={decision}
      question={`${SIDE_NAME[decision.side]}: realign (${attempts} attempt${attempts === 1 ? "" : "s"} left)`}
      choices={choices}
      onAnswer={onAnswer}
      place={place}
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
  extraPlay: ExtraPlayPrompt,
};
