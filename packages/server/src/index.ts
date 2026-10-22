// Public entry point of the server package (docs/architecture.md, Decision 5).
export { submit } from "./submit.ts";
export type { ServerErrorCode, SubmitDeps, SubmitError, SubmitOutcome, SubmitRequest } from "./submit.ts";
export { MemoryStore } from "./store.ts";
export { SupabaseStore } from "./supabaseStore.ts";
export type { CommitResult, LoadedMatch, MatchStore, MatchWrite } from "./store.ts";
export type { DeadlineStore } from "./deadlineStore.ts";
export { sweepDeadlines } from "./sweepDeadlines.ts";
export type { SweepResult } from "./sweepDeadlines.ts";
export { alertsFrom, MemoryNotifyStore, TURN_ALERT_DELAY_MS } from "./notifyStore.ts";
export type { NotifyStore, TurnAlert } from "./notifyStore.ts";
export { sweepTurnAlerts } from "./sweepTurnAlerts.ts";
export type { TurnAlertDeps, TurnAlertResult } from "./sweepTurnAlerts.ts";
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
export { MemoryMailer } from "./mailer.ts";
export type { Email, Mailer, SendResult } from "./mailer.ts";
export { RESEND_SEND_URL, resendMailer } from "./resendMailer.ts";
export type { MailFetch, ResendOptions } from "./resendMailer.ts";
export { signInCodeEmail, turnAlertEmail } from "./mailMessages.ts";
export { SupabaseInviteStore } from "./supabaseInviteStore.ts";
export type { AcceptResult, Invite, InviteStore, SaveResult, SideMode, StoredInvite } from "./inviteStore.ts";
