// The types of pending decisions and their answers (hard rule 4: every wait for a player is a Decision). Split out
// of types.ts, which re-exports them, so index.ts exports the same names.
import type { CountryId } from "./mapTypes.ts";
import type { ActionAnswer, ActionOptions, PlaceOptions } from "./placingTypes.ts";
import type { RealignOptions } from "./realignTypes.ts";
import type { CardId, Side } from "./types.ts";

/**
 * `chooseCard`: both sides secretly pick their opening card for the turn. `playCardAs`: one side plays a
 * card from its hand for its event or its points. `rivalEventOrder`: having played a rival's card for
 * its points, that side says whether the card's event happens before or after the points. `discardCards`: a
 * side picks the cards a discardFromHand step discards, from its own hand or the rival's (discardChoice.ts).
 * `placeInfluence`: a side spending points places one influence in a country (placing.ts). `chooseAction`: a
 * side spending points picks the one action they all go to: placing, an intervention (intervening.ts) or
 * realigning (actionMenu.ts). `realign`: a side picks the country of its next realignment attempt (realign.ts).
 */
export type DecisionKind =
  | "yesNo"
  | "chooseCard"
  | "playCardAs"
  | "rivalEventOrder"
  | "discardCards"
  | "placeInfluence"
  | "chooseAction"
  | "realign";
/** What a played card is used for: its event, or its action points. */
export type PlayUse = "event" | "points";
/** The uses a play allows, by whose card it is: the player's own, the rival's, or neutral. */
export type PlayUses = { own: PlayUse[]; rival: PlayUse[]; neutral: PlayUse[] };
/**
 * Declarative description of what is legal. Never lists hidden data such as card IDs from a hand. A
 * yes/no or a rivalEventOrder has none; the opening pick says "any card from your hand", neutral ones
 * too; a play says "a card from your hand" and the uses each kind of card allows; a discard pick says whose
 * hand, the picker's own or the rival's, and how many cards; a placing says the points left and the countries;
 * an action choice says the points, the actions and the countries open to an intervention; a realignment the
 * attempts left and the target countries.
 */
export type DecisionOptions =
  | Record<string, never>
  | { from: "hand" }
  | { from: "hand"; uses: PlayUses }
  | { from: "hand" | "rivalHand"; count: number }
  | PlaceOptions
  | ActionOptions
  | RealignOptions;
export type Decision = {
  /** Unique within the game; answers quote it. */
  id: string;
  /** Who must answer. */
  side: Side;
  kind: DecisionKind;
  options: DecisionOptions;
  /**
   * Set when both sides answer at once and in secret: the group both decisions share. Each answer
   * stays in the answering side's private compartment until the other side's is in.
   */
  simultaneousGroup?: string;
};

export type AnswerValue =
  | { kind: "yesNo"; yes: boolean }
  | { kind: "chooseCard"; card: CardId }
  | { kind: "playCardAs"; card: CardId; as: PlayUse }
  | { kind: "rivalEventOrder"; event: "before" | "after" }
  | { kind: "discardCards"; cards: CardId[] }
  | { kind: "placeInfluence"; country: CountryId }
  | ActionAnswer
  /** `country` null: stop realigning, leaving the attempts left unmade. */
  | { kind: "realign"; country: CountryId | null };
/** A timeout naming "both" is a simultaneous pick missed by both sides: a draw. */
export type Answer =
  | { decisionId: string; side: Side; value: AnswerValue }
  | { system: "timeout"; side: Side | "both" }
  | { system: "resign" | "adjudicate"; side: Side };
