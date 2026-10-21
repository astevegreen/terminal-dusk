// Public entry point of the server package (docs/architecture.md, Decision 5).
export { submit } from "./submit.ts";
export type { ServerErrorCode, SubmitDeps, SubmitError, SubmitOutcome, SubmitRequest } from "./submit.ts";
export { MemoryStore } from "./store.ts";
export type { CommitResult, LoadedMatch, MatchStore, MatchWrite } from "./store.ts";
export { rowsFor, VIEWERS } from "./rows.ts";
export type { CommitRows, MatchEventRow, MatchRow, MatchViewRow } from "./rows.ts";
export { canRead, readMatch } from "./read.ts";
export type { Caller, MatchRead, ReadStore, StoredRows } from "./read.ts";
