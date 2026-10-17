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

/** Placeholder until #31 defines events. */
export type GameEvent = never;

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

export type Setup = {
  seedHash: string;
  hands: Record<Side, CardId[]>;
  deck: CardId[];
  /** Placeholder game length: how many times each side answers. Replaced by the turn structure (#35). */
  rounds: number;
};
