// Public entry point of the rules engine. Only the exports listed in .claude/rules/engine.md belong here.
export { apply } from "./apply.ts";
export { createGame } from "./createGame.ts";
export { legalAnswers, pendingFor } from "./decisions.ts";
export { SIDES } from "./types.ts";
export type {
  Answer,
  AnswerValue,
  CardId,
  Decision,
  DecisionKind,
  DecisionOptions,
  EngineError,
  EngineErrorCode,
  GameEvent,
  GameState,
  GameStatus,
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
