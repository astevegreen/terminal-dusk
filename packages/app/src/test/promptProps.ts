// Test helper: the props a decision prompt needs when the decision lists no cards (placing, action choice).
import type { PromptProps } from "../decisionPrompts.tsx";

/** A country's name in tests: its id with a capital letter, so a test can tell a name from an id. */
export const testCountryName = (id: string): string => `${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/** Props for `decision` with an empty hand, plain labels and country names; with `onAnswer` the prompt shows buttons. */
export const promptProps = (decision: PromptProps["decision"], onAnswer?: PromptProps["onAnswer"]): PromptProps => ({
  decision,
  hand: [],
  known: [],
  label: (card) => `Card ${card}`,
  country: testCountryName,
  affiliation: () => "neutral",
  stack: [],
  question: () => undefined,
  ...(onAnswer ? { onAnswer } : {}),
});
