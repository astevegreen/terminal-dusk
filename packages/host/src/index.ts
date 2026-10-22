// Public entry point of MatchHost (docs/architecture.md, Decision 3).
export { hostCreate } from "./hostCreate.ts";
export { hostSubmit } from "./hostSubmit.ts";
export { hostTimeout } from "./hostTimeout.ts";
export { hostArchive } from "./hostArchive.ts";
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
  ReplayArchive,
  ReplayFrame,
  Submission,
} from "./types.ts";
