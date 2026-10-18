// Public entry point of MatchHost (docs/architecture.md, Decision 3).
export { hostCreate } from "./hostCreate.ts";
export { hostSubmit } from "./hostSubmit.ts";
export type {
  Frame,
  HostEffect,
  HostError,
  HostErrorCode,
  HostOutcome,
  HostResult,
  MatchConfig,
  MatchRecord,
  MatchSecret,
  PlayerId,
  Submission,
} from "./types.ts";
