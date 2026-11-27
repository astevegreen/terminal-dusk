// What the screens talk to: one viewer's window onto a match. The local transport and the remote (online)
// transport both implement it (docs/architecture.md, section 3).
import type { AnswerValue } from "@terminal-dusk/engine";
import type { Frame, HostError } from "@terminal-dusk/host";

/** Codes only the server's submit function gives (on top of the host's and the engine's). */
export type ServerErrorCode =
  "matchNotFound" | "unknownRuleset" | "storageFailed" | "notSignedIn" | "methodNotAllowed" | "internalError";

/**
 * Why an answer was refused: a host or engine code, a server code, `networkError` when no reply came, or
 * `notInLesson` when a tutorial step does not allow that answer (it never reaches the host).
 */
export type TransportError = {
  code: HostError["code"] | ServerErrorCode | "networkError" | "notInLesson";
  message?: string;
};

export type SubmitResult = { ok: true } | { ok: false; error: TransportError };

/**
 * Whether the server still lets the caller read the match: "notSignedIn" once it refuses the caller's token
 * (#536), "live" again once a read succeeds. A failure with no reply or a server error changes nothing.
 */
export type TransportStatus = "live" | "notSignedIn";

export type MatchTransport = {
  /**
   * Calls `onFrame` at once with the latest frame, then with each new one, and `onStatus` (if given) each time
   * the status changes; it starts "live" and is not called for that. The returned function stops both. The
   * local transport never calls `onStatus`.
   */
  subscribe(onFrame: (frame: Frame) => void, onStatus?: (status: TransportStatus) => void): () => void;
  /** Sends an answer. Answers are handled one at a time, in the order sent. */
  submit(s: { decisionId: string; expectedSeq: number; value: AnswerValue }): Promise<SubmitResult>;
  resign(): Promise<SubmitResult>;
};
