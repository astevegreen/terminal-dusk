// Test helpers for the card schema: a valid card file, the issues the schema finds, and steps to build effects from.
import { cardSchema } from "../card.ts";

/** A card file with every field, as plain JSON data. Each test changes one thing about it. */
export const validCard = () => ({
  id: "test-card",
  era: "early",
  ops: 2,
  affiliation: "neutral",
  effect: [{ op: "marker", label: "ran" }],
  text: { name: "Test card", rules: "Does nothing.", history: "A card for tests.", art: "art/test-card" },
});

/** The issues the schema finds in `data`: none when it passes. */
export const issuesOf = (data: unknown) => {
  const result = cardSchema.safeParse(data);
  return result.success ? [] : result.error.issues;
};
export const pathsOf = (data: unknown) => issuesOf(data).map((issue) => issue.path);

export const yesNo = { op: "choose", who: "lio", decision: { kind: "yesNo" }, bind: "agreed" };
export const pickCard = { op: "choose", who: "both", decision: { kind: "chooseCard" }, bind: "picked" };
export const drawFor = { op: "drawContingency", side: "lio", bind: "drawn" };
export const lioCard = () => ({ ...validCard(), affiliation: "lio" });
