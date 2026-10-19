// What the vs-AI session talks to: an opponent that answers one view at a time (docs/architecture.md, Decision 8).
// The real one runs in a Web Worker (workerAi.ts); tests use a stand-in that calls the AI directly.
import type { AnswerValue, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";

export type AiOpponent = {
  /** The AI's answer to the decision waiting in `view`, or null when it has none. */
  answer(view: PlayerView): Promise<AnswerValue | null>;
  /** Ends the opponent; answers still on their way are dropped. */
  stop(): void;
};

/** Makes an opponent playing `side` from `seed`. */
export type MakeAi = (ruleset: Ruleset, side: Side, seed: number) => AiOpponent;
