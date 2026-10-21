// Public entry point of the server package (docs/architecture.md, Decision 5).
export { submit } from "./submit.ts";
export type { ServerErrorCode, SubmitDeps, SubmitError, SubmitOutcome, SubmitRequest } from "./submit.ts";
export { MemoryStore } from "./store.ts";
export type { CommitResult, LoadedMatch, MatchStore, MatchWrite } from "./store.ts";
