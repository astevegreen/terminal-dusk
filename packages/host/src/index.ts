// Public entry point of MatchHost (docs/architecture.md, Decision 3).
export { hostCreate } from "./hostCreate.ts";
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
} from "./types.ts";
