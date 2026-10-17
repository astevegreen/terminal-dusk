// Core engine types: sides, results and the three-compartment game state.
import type { RngState } from "./rng.ts";

export type Side = "lio" | "sae";
/** Both sides, in the one order the engine always loops in. */
export const SIDES: readonly Side[] = ["lio", "sae"];

export type CardId = string;
export type RulesetId = string;
export type Seed = string;

export type Ruleset = { readonly id: RulesetId };

export type EngineErrorCode =
  | "invalidSeed"
  | "invalidSetup"
  | "rulesetMismatch"
  | "unknownDecision"
  | "wrongSide"
  | "illegalAnswer"
  | "gameOver"
  | "notSupported";
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
/** An event anyone may see. It never carries a card ID that is hidden from someone. */
export type PublicEvent = CardDrawnHidden;
/**
 * What happened, for animation, the game log, sounds and the tutorial. An event visible to one side
 * may carry a `publicForm`: the public event everyone else gets instead (see eventsFor).
 */
export type GameEvent = CardDrawn | CardDrawnHidden;
export type EventKind = GameEvent["kind"];

export type DecisionKind = "pass";
/** Declarative description of what is legal. Never lists hidden data such as card IDs from a hand. */
export type DecisionOptions = Record<string, never>;
export type Decision = {
  /** Unique within the game; answers quote it. */
  id: string;
  /** Who must answer. */
  side: Side;
  kind: DecisionKind;
  options: DecisionOptions;
};

export type AnswerValue = { kind: "pass" };
export type Answer =
  { decisionId: string; side: Side; value: AnswerValue } | { system: "timeout" | "resign" | "adjudicate"; side: Side };

export type GameStatus = { kind: "active" } | { kind: "over"; winner: Side | null; reason: string };

/** Visible to everyone. `rounds` belongs to the placeholder game (see apply.ts). */
export type PublicState = {
  turn: number;
  rounds: number;
  discard: CardId[];
  /** Open decisions, in SIDES order. */
  pending: Decision[];
  status: GameStatus;
};
/** Visible to one side only. */
export type PrivateState = { hand: CardId[] };
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
  /** Placeholder game length: how many times each side answers. Replaced by the turn structure (#35). */
  rounds: number;
};
