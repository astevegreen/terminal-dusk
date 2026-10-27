// Test helper: the props a decision prompt needs when the decision lists no cards (placing, action choice).
import type { PromptProps } from "../decisionPrompts.tsx";

/** Props for `decision` with an empty hand and plain labels; with `onAnswer` the prompt shows buttons. */
export const promptProps = (decision: PromptProps["decision"], onAnswer?: PromptProps["onAnswer"]): PromptProps => ({
  decision,
  hand: [],
  known: [],
  label: (card) => `Card ${card}`,
  affiliation: () => "neutral",
  stack: [],
  question: () => undefined,
  ...(onAnswer ? { onAnswer } : {}),
});
