// Public entry point of the rules engine. Only the exports listed in .claude/rules/engine.md belong here.
export { createGame } from "./createGame.ts";
export { SIDES } from "./types.ts";
export type {
  CardId,
  EngineError,
  GameEvent,
  GameState,
  MetaState,
  PrivateState,
  PublicState,
  Result,
  Ruleset,
  RulesetId,
  SecretState,
  Seed,
  Setup,
  Side,
} from "./types.ts";
