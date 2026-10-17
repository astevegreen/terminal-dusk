// Core engine types: sides, results and the three-compartment game state.
import type { RngState } from "./rng.ts";

export type Side = "lio" | "sae";
/** Both sides, in the one order the engine always loops in. */
export const SIDES: readonly Side[] = ["lio", "sae"];

export type CardId = string;
export type RulesetId = string;
export type Seed = string;

export type Ruleset = { readonly id: RulesetId };

export type EngineError = { code: string; message?: string };
export type Result<T> = { ok: true; value: T } | { ok: false; error: EngineError };

/** Placeholder until #31 defines events. */
export type GameEvent = never;

/** Visible to everyone. */
export type PublicState = { turn: number; discard: CardId[] };
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
};
