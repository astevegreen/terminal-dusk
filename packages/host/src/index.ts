// Public entry point of MatchHost (docs/architecture.md, Decision 3).
export { hostCreate } from "./hostCreate.ts";
export { hostSubmit } from "./hostSubmit.ts";
export { hostTimeout } from "./hostTimeout.ts";
export { hostDeadline } from "./hostDeadline.ts";
export { hostArchive } from "./hostArchive.ts";
export type {
  DeadlineRule,
  Frame,
  HostEffect,
  HostError,
  HostErrorCode,
  HostOutcome,
  HostResult,
  MatchClock,
  MatchConfig,
  MatchDeadline,
  MatchRecord,
  MatchSecret,
  PlayerId,
  ReplayArchive,
  ReplayFrame,
  Submission,
} from "./types.ts";
