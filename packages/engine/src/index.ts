// Public entry point of the rules engine. Only the exports listed in .claude/rules/engine.md belong here.
export { apply } from "./apply.ts";
export { createGame } from "./createGame.ts";
export { legalAnswers, pendingFor } from "./decisions.ts";
export { eventsFor } from "./events.ts";
export { SIDES } from "./types.ts";
export { hiddenPart, reconstruct, viewFor } from "./views.ts";
export type {
  Answer,
  AnswerValue,
  CardDrawn,
  CardDrawnHidden,
  CardId,
  Decision,
  DecisionKind,
  DecisionOptions,
  EngineError,
  EngineErrorCode,
  EventKind,
  GameEvent,
  GameState,
  GameStatus,
  HiddenCounts,
  HiddenPart,
  MetaState,
  PlayerView,
  PrivateState,
  PublicEvent,
  PublicMeta,
  PublicState,
  Result,
  Ruleset,
  RulesetId,
  SecretState,
  Seed,
  Setup,
  Side,
  Viewer,
  Visibility,
} from "./types.ts";
