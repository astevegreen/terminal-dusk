// What the screens talk to: one viewer's window onto a match. The local transport and the remote (online)
// transport both implement it (docs/architecture.md, section 3).
import type { AnswerValue } from "@terminal-dusk/engine";
import type { Frame, HostError } from "@terminal-dusk/host";

/** Codes only the server's submit function gives (on top of the host's and the engine's). */
export type ServerErrorCode =
  "matchNotFound" | "unknownRuleset" | "storageFailed" | "notSignedIn" | "methodNotAllowed" | "internalError";

/** Why an answer was refused: a host or engine code, a server code, or `networkError` when no reply came. */
export type TransportError = { code: HostError["code"] | ServerErrorCode | "networkError"; message?: string };

export type SubmitResult = { ok: true } | { ok: false; error: TransportError };

export type MatchTransport = {
  /** Calls `onFrame` at once with the latest frame, then with each new one. The returned function stops it. */
  subscribe(onFrame: (frame: Frame) => void): () => void;
  /** Sends an answer. Answers are handled one at a time, in the order sent. */
  submit(s: { decisionId: string; expectedSeq: number; value: AnswerValue }): Promise<SubmitResult>;
  resign(): Promise<SubmitResult>;
};
