// Core engine types: sides, results and the three-compartment game state.
import type { RngState } from "./rng.ts";

export type Side = "lio" | "sae";
/** Both sides, in the one order the engine always loops in. */
export const SIDES: readonly Side[] = ["lio", "sae"];

/** The other side: LIO for SAE, SAE for LIO. */
export const otherSide = (side: Side): Side => (side === "lio" ? "sae" : "lio");

export type CardId = string;
export type EraId = string;
export type RulesetId = string;
export type Seed = string;

/**
 * One card's rules (docs/architecture.md, section 4). `ops` is a whole number, 0 or more. The other
 * fields there (`flags`, `text`) arrive with the content schemas.
 */
export type CardDef = {
  readonly id: CardId;
  readonly era: EraId;
  readonly ops: number;
  readonly affiliation: Side | "neutral";
  readonly effect: Step[];
};

/** Card definitions and limits. Passed into apply on every call; never copied into the state. */
export type Ruleset = {
  readonly id: RulesetId;
  /** Every card the game may use, each `id` once. It may hold cards no setup uses yet (a later era's). */
  readonly cards: readonly CardDef[];
  /** `stepBudget`: most stack steps one call may run (default 10,000). */
  readonly limits?: { readonly stepBudget?: number };
};

export type EngineErrorCode =
  | "invalidSeed"
  | "invalidRuleset"
  | "invalidSetup"
  | "seedMismatch"
  | "rulesetMismatch"
  | "unknownDecision"
  | "wrongSide"
  | "illegalAnswer"
  | "gameOver"
  | "notSupported"
  | "stepBudgetExceeded"
  | "invalidProgram"
  | "alreadyAnswered"
  | "unfinishedLog";
export type EngineError = { code: EngineErrorCode; message?: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: EngineError };

/** Who may see an event: everyone, or one side only. */
export type Visibility = "public" | Side;
/**
 * Who a live view or event list is for: a side or a spectator. Frames and the fuzz suite use only these.
 * Replays also have the omniscient viewer: see ReplayViewer.
 */
export type Viewer = Side | "spectator";
/** Every viewer: the live ones, plus `omniscient` (everything but the secret compartment), only for replays. */
export type ReplayViewer = Viewer | "omniscient";

/** Everyone else's version of a drawn card: who drew, never which card. */
export type CardDrawnHidden = { kind: "cardDrawnHidden"; visibility: "public"; side: Side };
/** A side drew `card`. Only that side sees it; everyone else gets `publicForm`. */
export type CardDrawn = {
  kind: "cardDrawn";
  visibility: Side;
  side: Side;
  card: CardId;
  publicForm: CardDrawnHidden;
};
/** A `marker` step ran: its label, and the value of the variable it names, if any. */
export type MarkerEvent = { kind: "marker"; visibility: "public"; label: string; value?: VarValue };
/**
 * A `spendPoints` step ran: `side`, who played the card (even when it is the rival's card), spent
 * `amount` action points, the card's ops. TEMPORARY until the actions are designed: nothing else happens.
 */
export type PointsSpent = { kind: "pointsSpent"; visibility: "public"; side: Side; amount: number };
/** A new era started: `cardsAdded` of its cards were shuffled into the draw pile. Never which cards. */
export type EraStarted = { kind: "eraStarted"; visibility: "public"; era: EraId; cardsAdded: number };
/** `side` drew a contingency: the top card of its own Contingency deck, numbered `value`. */
export type ContingencyDrawn = { kind: "contingencyDrawn"; visibility: "public"; side: Side; value: number };
/** A draw left one card in `side`'s Contingency deck, so all its cards were shuffled back together. */
export type ContingencyDeckReshuffled = { kind: "contingencyDeckReshuffled"; visibility: "public"; side: Side };
/** A `modifier` step ran: `source`'s effect made the rule change `mod`, in force until `expires`. */
export type ModifierStarted = {
  kind: "modifierStarted";
  visibility: "public";
  source: CardId;
  mod: ModifierSpec;
  expires: ModifierExpiry;
};
/** A modifier's duration ran out (the turn it was made in ended), so its rule change no longer applies. */
export type ModifierEnded = { kind: "modifierEnded"; visibility: "public"; source: CardId; mod: ModifierSpec };
/** An event anyone may see. It never carries a card ID that is hidden from someone, or a deck's order. */
export type PublicEvent =
  | CardDrawnHidden
  | MarkerEvent
  | PointsSpent
  | EraStarted
  | ContingencyDrawn
  | ContingencyDeckReshuffled
  | ModifierStarted
  | ModifierEnded;
/**
 * What happened, for animation, the game log, sounds and the tutorial. An event visible to one side
 * may carry a `publicForm`: the public event everyone else gets instead (see eventsFor).
 */
export type GameEvent = CardDrawn | PublicEvent;
export type EventKind = GameEvent["kind"];

/**
 * `chooseCard`: both sides secretly pick their opening card for the turn. `playCardAs`: one side plays a
 * card from its hand for its event or its points. `rivalEventOrder`: having played a rival's card for
 * its points, that side says whether the card's event happens before or after the points.
 */
export type DecisionKind = "yesNo" | "chooseCard" | "playCardAs" | "rivalEventOrder";
/** What a played card is used for: its event, or its action points. */
export type PlayUse = "event" | "points";
/** The uses a play allows, by whose card it is: the player's own, the rival's, or neutral. */
export type PlayUses = { own: PlayUse[]; rival: PlayUse[]; neutral: PlayUse[] };
/**
 * Declarative description of what is legal. Never lists hidden data such as card IDs from a hand. A
 * yes/no or a rivalEventOrder has none; the opening pick says "a card from your hand" and whether
 * neutral cards count; a play says "a card from your hand" and the uses each kind of card allows.
 */
export type DecisionOptions =
  Record<string, never> | { from: "hand"; includeNeutral: boolean } | { from: "hand"; uses: PlayUses };
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
  | { kind: "rivalEventOrder"; event: "before" | "after" };
export type Answer =
  { decisionId: string; side: Side; value: AnswerValue } | { system: "timeout" | "resign" | "adjudicate"; side: Side };

export type VarName = string;
/** Both sides' yes/no answers to a simultaneous choice, keyed by side in SIDES order. */
export type BothAnswers = Record<Side, boolean>;
/** Both sides' picked cards from a simultaneous card choice, keyed by side in SIDES order. */
export type BothCards = Record<Side, CardId>;
/**
 * A variable's value: one side's yes/no answer, both sides' answers or picked cards, the current item
 * of a forEach, or the number a contingency draw gave.
 */
export type VarValue = boolean | BothAnswers | BothCards | string | number;
/**
 * True when the yes/no variable `var` holds yes. For a variable holding both sides' answers, `side`
 * names whose answer to read; for one side's answer it is left out. `atLeast`, `atMost` and `equals`
 * test the number bound to `var` (a contingency draw) against the whole number `value`.
 */
export type Condition =
  { op: "yes"; var: VarName; side?: Side } | { op: "atLeast" | "atMost" | "equals"; var: VarName; value: number };
/**
 * One step of an effect program (docs/architecture.md, section 4). More kinds arrive with later tasks.
 * A card choice is only ever both sides at once: the turn's opening pick (turn.ts). Card effects may
 * not hold one (cardChecks.ts). `spendPoints` is how a play for points spends them (turn.ts):
 * TEMPORARY until the actions are designed, it only emits a pointsSpent event. `drawContingency`
 * draws from `side`'s Contingency deck (an event draws from the deck of the side it belongs to) and
 * binds the number to `bind`, if given.
 * `addToNumber` adds the non-zero whole `amount` (negative subtracts) to the number bound to `var`.
 * `modifier` makes a rule change, `mod`, that lasts for `duration`; its source is the card whose effect runs it.
 * A `spendPoints` `amount` is the printed ops: the opsValue modifiers in force change it when the step runs.
 */
export type Step =
  | { op: "choose"; who: Side | "both"; decision: { kind: "yesNo" }; bind: VarName }
  | { op: "choose"; who: "both"; decision: { kind: "chooseCard" }; bind: VarName }
  | { op: "if"; cond: Condition; then: Step[]; else?: Step[] }
  | { op: "forEach"; over: string[]; bind: VarName; do: Step[] }
  | { op: "marker"; label: string; var?: VarName }
  | { op: "spendPoints"; side: Side; amount: number }
  | { op: "drawContingency"; side: Side; bind?: VarName }
  | { op: "addToNumber"; var: VarName; amount: number }
  | { op: "modifier"; mod: ModifierSpec; duration: Duration };

/** How long a modifier lasts. `turnEnd`: until the end of the turn in which it was made. */
export type Duration = { kind: "turnEnd" };
/**
 * A rule change (docs/architecture.md, section 4, "Modifiers"), consulted only at its hook. `opsValue`:
 * for cards whose action points `side` (or either side, for "both") spends, the ops value is `add` more
 * (negative: less), then never below `min` when given. `add` is a non-zero whole number, `min` a whole
 * number, 0 or more. How several combine, and the floor of 0, are in modifiers.ts.
 */
export type ModifierSpec = { hook: "opsValue"; side: Side | "both"; add: number; min?: number };
/** When a modifier in force ends: at the end of turn `turn`, the turn it was made in. */
export type ModifierExpiry = { kind: "turnEnd"; turn: number };
/** A modifier in force: the card whose effect made it, the rule change, and when it ends. */
export type ActiveModifier = { source: CardId; mod: ModifierSpec; expires: ModifierExpiry };

export type Binding = { name: VarName; value: VarValue };
/** The block a frame runs, the index of its next step, and the variables bound in it, in binding order. */
type FrameBase = { steps: Step[]; next: number; vars: Binding[] };
/**
 * One running block on the resolution stack: a program, an `if` branch, or a `forEach` body with its
 * items and the index of the current one. Frames are public: they never hold hidden data. A program run
 * for a card's effect or play records that card as `source`; the blocks inside it read their program's.
 * A program no card started (a turn's opening pick) has none.
 */
export type Frame =
  | (FrameBase & { kind: "program"; source?: CardId })
  | (FrameBase & { kind: "if" })
  | (FrameBase & { kind: "forEach"; bind: VarName; items: string[]; index: number });

export type GameStatus = { kind: "active" } | { kind: "over"; winner: Side | null; reason: string };

/** Visible to everyone. */
export type PublicState = {
  /** The current turn: 1 in the first, up by one as each new turn starts. */
  turn: number;
  /** How many turns the game lasts, and how many plays each side makes per turn (from the setup). */
  turns: number;
  playsPerTurn: number;
  /** Plays made this turn after the opening cards, both sides together. LIO plays when it is even. */
  playsMade: number;
  /**
   * Cards whose effects have not finished: the revealed opening cards, in resolution order, or the
   * card being played. A card goes to the discard pile once everything it triggered has finished.
   */
  inPlay: CardId[];
  discard: CardId[];
  /** Open decisions, in SIDES order. */
  pending: Decision[];
  /** The resolution stack, bottom first. A paused program waits on the top frame's `choose`. */
  stack: Frame[];
  status: GameStatus;
  /** Each side's Contingency deck, the numbered cards drawn instead of rolling a die. The order is secret. */
  contingency: Record<Side, ContingencyDeck>;
  /** The rule changes in force, in the order they were made (modifiers.ts). */
  modifiers: ActiveModifier[];
};
/**
 * One Contingency deck's public side: `cards` is its full contents, sorted ascending, and never changes
 * (a reshuffle rebuilds the deck from it); `left` is the numbers still in the deck, sorted ascending.
 */
export type ContingencyDeck = { cards: number[]; left: number[] };
/** A side's answer to its decision in a simultaneous group, kept secret until the other side's is in. */
export type UnrevealedPick = { group: string; decisionId: string; value: AnswerValue };
/** Visible to one side only: its hand, and its own unrevealed picks. */
export type PrivateState = { hand: CardId[]; picks: UnrevealedPick[] };
/**
 * An era after the first: its cards, in the setup's order, and the turn at whose start they are
 * shuffled into the draw pile (eras.ts).
 */
export type EraEntry = { era: EraId; turn: number; cards: CardId[] };
/**
 * Visible to the host only. `eras`: the eras still to enter, in the setup's order. `contingency`: the
 * order of the cards left in each side's Contingency deck, top card first.
 */
export type SecretState = { rng: RngState; deck: CardId[]; eras: EraEntry[]; contingency: Record<Side, number[]> };
export type MetaState = { ruleset: RulesetId; seedHash: string; seq: number };

export type GameState = {
  public: PublicState;
  private: Record<Side, PrivateState>;
  secret: SecretState;
  meta: MetaState;
};

/** Sizes of everything a viewer cannot see. A hand the viewer cannot see is only ever a number. */
export type HiddenCounts = { deck: number; hands: Record<Side, number> };
/** Every meta field is public: `seedHash` is the published hash, never the seed. */
export type PublicMeta = MetaState;
/** What one viewer receives. `mine` is the viewer's own private compartment, or null for a spectator. */
export type PlayerView = { public: PublicState; mine: PrivateState | null; counts: HiddenCounts; meta: PublicMeta };
/**
 * What a replay's omniscient viewer receives: the public compartment, both sides' private compartments,
 * the counts and the meta. Never the secret compartment: a finished game's seed and move log recompute it.
 * It has no `mine`, so it can never stand in for a live frame's PlayerView.
 */
export type OmniscientView = {
  public: PublicState;
  sides: Record<Side, PrivateState>;
  counts: HiddenCounts;
  meta: PublicMeta;
};
/** What `viewer` cannot see: the opponent's private compartment and the secret compartment. */
export type HiddenPart = { viewer: Side; opponent: PrivateState; secret: SecretState };

export type Setup = {
  seedHash: string;
  hands: Record<Side, CardId[]>;
  deck: CardId[];
  /** How many turns the game lasts: a whole number, 1 or more. */
  turns: number;
  /** How many plays each side makes per turn, after the opening cards: a whole number, 1 or more. */
  playsPerTurn: number;
  /** The eras after the first, each entering on its own turn, from 2 to the last. None when left out. */
  eras?: EraEntry[];
  /** Each side's Contingency deck: whole numbers, 1 or more, at least 2 cards, in any order. */
  contingency: Record<Side, number[]>;
};
