// Core engine types: sides, results and the three-compartment game state.
import type { RngState } from "./rng.ts";

export type Side = "lio" | "sae";
/** Both sides, in the one order the engine always loops in. */
export const SIDES: readonly Side[] = ["lio", "sae"];

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
  | "rulesetMismatch"
  | "unknownDecision"
  | "wrongSide"
  | "illegalAnswer"
  | "gameOver"
  | "notSupported"
  | "stepBudgetExceeded"
  | "invalidProgram"
  | "alreadyAnswered";
export type EngineError = { code: EngineErrorCode; message?: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: EngineError };

/** Who may see an event: everyone, or one side only. */
export type Visibility = "public" | Side;
/** Who a view or an event list is for. ('omniscient' arrives with the match host's replay archive.) */
export type Viewer = Side | "spectator";

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
/** An event anyone may see. It never carries a card ID that is hidden from someone. */
export type PublicEvent = CardDrawnHidden | MarkerEvent;
/**
 * What happened, for animation, the game log, sounds and the tutorial. An event visible to one side
 * may carry a `publicForm`: the public event everyone else gets instead (see eventsFor).
 */
export type GameEvent = CardDrawn | CardDrawnHidden | MarkerEvent;
export type EventKind = GameEvent["kind"];

export type DecisionKind = "pass" | "yesNo";
/** Declarative description of what is legal. Never lists hidden data such as card IDs from a hand. */
export type DecisionOptions = Record<string, never>;
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

export type AnswerValue = { kind: "pass" } | { kind: "yesNo"; yes: boolean };
export type Answer =
  { decisionId: string; side: Side; value: AnswerValue } | { system: "timeout" | "resign" | "adjudicate"; side: Side };

export type VarName = string;
/** Both sides' yes/no answers to a simultaneous choice, keyed by side in SIDES order. */
export type BothAnswers = Record<Side, boolean>;
/** A variable's value: one side's yes/no answer, both sides' answers, or the current item of a forEach. */
export type VarValue = boolean | BothAnswers | string;
/**
 * True when the yes/no variable `var` holds yes. For a variable holding both sides' answers, `side`
 * names whose answer to read; for one side's answer it is left out.
 */
export type Condition = { op: "yes"; var: VarName; side?: Side };
/** One step of an effect program (docs/architecture.md, section 4). More kinds arrive with later tasks. */
export type Step =
  | { op: "choose"; who: Side | "both"; decision: { kind: "yesNo" }; bind: VarName }
  | { op: "if"; cond: Condition; then: Step[]; else?: Step[] }
  | { op: "forEach"; over: string[]; bind: VarName; do: Step[] }
  | { op: "marker"; label: string; var?: VarName };

export type Binding = { name: VarName; value: VarValue };
/** The block a frame runs, the index of its next step, and the variables bound in it, in binding order. */
type FrameBase = { steps: Step[]; next: number; vars: Binding[] };
/**
 * One running block on the resolution stack: a program, an `if` branch, or a `forEach` body with its
 * items and the index of the current one. Frames are public: they never hold hidden data.
 */
export type Frame =
  | (FrameBase & { kind: "program" | "if" })
  | (FrameBase & { kind: "forEach"; bind: VarName; items: string[]; index: number });

export type GameStatus = { kind: "active" } | { kind: "over"; winner: Side | null; reason: string };

/** Visible to everyone. `rounds` belongs to the placeholder game (see apply.ts). */
export type PublicState = {
  turn: number;
  rounds: number;
  discard: CardId[];
  /** Open decisions, in SIDES order. */
  pending: Decision[];
  /** The resolution stack, bottom first. A paused program waits on the top frame's `choose`. */
  stack: Frame[];
  status: GameStatus;
};
/** A side's answer to its decision in a simultaneous group, kept secret until the other side's is in. */
export type UnrevealedPick = { group: string; decisionId: string; value: AnswerValue };
/** Visible to one side only: its hand, and its own unrevealed picks. */
export type PrivateState = { hand: CardId[]; picks: UnrevealedPick[] };
/** Visible to the host only. */
export type SecretState = { rng: RngState; deck: CardId[] };
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
/** What `viewer` cannot see: the opponent's private compartment and the secret compartment. */
export type HiddenPart = { viewer: Side; opponent: PrivateState; secret: SecretState };

export type Setup = {
  seedHash: string;
  hands: Record<Side, CardId[]>;
  deck: CardId[];
  /** Placeholder game length in rounds (see apply.ts). Replaced by the turn structure (#35). */
  rounds: number;
};
