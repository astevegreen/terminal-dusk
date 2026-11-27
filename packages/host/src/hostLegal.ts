// The answers the rules accept from one side right now (#641). Lets a client-side helper (the tutorial match) check
// its own limits against the rules without touching GameState itself (hard rule 2): only the host reads the state.
import { legalAnswers } from "@terminal-dusk/engine";
import type { AnswerValue, Ruleset, Side } from "@terminal-dusk/engine";
import type { MatchSecret } from "./types.ts";

/** Every answer `side` may send to its waiting decision, in the engine's order; empty when nothing waits for it. */
export function hostLegalAnswers(ruleset: Ruleset, secret: MatchSecret, side: Side): AnswerValue[] {
  return legalAnswers(ruleset, secret.state, side);
}
