// What the screens talk to: one viewer's window onto a match. The local transport implements it now;
// the online transport will implement the same interface later (docs/architecture.md, section 3).
import type { AnswerValue } from "@terminal-dusk/engine";
import type { Frame, HostError } from "@terminal-dusk/host";

export type SubmitResult = { ok: true } | { ok: false; error: HostError };

export type MatchTransport = {
  /** Calls `onFrame` at once with the latest frame, then with each new one. The returned function stops it. */
  subscribe(onFrame: (frame: Frame) => void): () => void;
  /** Sends an answer. Answers are handled one at a time, in the order sent. */
  submit(s: { decisionId: string; expectedSeq: number; value: AnswerValue }): Promise<SubmitResult>;
  resign(): Promise<SubmitResult>;
};
