// Public entry point of the server package (docs/architecture.md, Decision 5).
export { submit } from "./submit.ts";
export type { ServerErrorCode, SubmitDeps, SubmitError, SubmitOutcome, SubmitRequest } from "./submit.ts";
export { CORS_HEADERS, handleSubmit } from "./submitHandler.ts";
export type { HandlerErrorCode, HttpReply, HttpRequest, SubmitHandlerDeps } from "./submitHandler.ts";
export { fetchHandler, supabaseAuthenticate } from "./submitEdge.ts";
export type { FetchRequest, MakeResponse } from "./submitEdge.ts";
export { MemoryStore } from "./store.ts";
export { SupabaseStore } from "./supabaseStore.ts";
export type { CommitResult, LoadedMatch, MatchStore, MatchWrite } from "./store.ts";
export { rowsFor, VIEWERS } from "./rows.ts";
export type { CommitRows, MatchEventRow, MatchRow, MatchViewRow } from "./rows.ts";
export { canRead, readMatch } from "./read.ts";
export type { Caller, MatchRead, ReadStore, StoredRows } from "./read.ts";
export { createInvite, joinInvite, previewInvite, sideModeOf, CODE_TRIES } from "./invite.ts";
export type {
  CreateInviteRequest,
  InviteDeps,
  InviteError,
  InviteErrorCode,
  InviteOutcome,
  JoinedInvite,
  JoinInviteRequest,
} from "./invite.ts";
export { inviteCode, INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "./inviteCode.ts";
export { MemoryInviteStore } from "./inviteStore.ts";
export type { AcceptResult, Invite, InviteStore, SaveResult, SideMode, StoredInvite } from "./inviteStore.ts";
