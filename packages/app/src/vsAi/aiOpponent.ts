// What the vs-AI session talks to: an opponent that answers one view at a time (docs/architecture.md, Decision 8).
// The real one runs in a Web Worker (workerAi.ts); tests use a stand-in that calls the AI directly.
import type { AnswerValue, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";

export type AiOpponent = {
  /** The AI's answer to the decision waiting in `view`, or null when it has none. */
  answer(view: PlayerView): Promise<AnswerValue | null>;
  /** Ends the opponent; answers still on their way are dropped. */
  stop(): void;
};

/** How strong the AI plays (#508): the worker's `tier`, the same names as the AI package's AiTier. */
export type AiTier = "easy" | "medium" | "hard";

/** Makes an opponent playing `side` from `seed` at difficulty `tier`. */
export type MakeAi = (ruleset: Ruleset, side: Side, seed: number, tier: AiTier) => AiOpponent;
