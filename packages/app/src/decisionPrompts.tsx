// One prompt component per DecisionKind. A new kind without an entry here fails the type check (hard rule 9).
import type { Decision, DecisionKind } from "@terminal-dusk/engine";
import type { ComponentType } from "react";

export type PromptComponent = ComponentType<{ decision: Decision }>;

/** Placeholder prompt until the first UI task. */
function PassPrompt({ decision }: Readonly<{ decision: Decision }>) {
  return <p>{`${decision.side} must pass.`}</p>;
}

/** Placeholder prompt until the first UI task. */
function YesNoPrompt({ decision }: Readonly<{ decision: Decision }>) {
  return <p>{`${decision.side}: yes or no?`}</p>;
}

export const decisionPrompts: Record<DecisionKind, PromptComponent> = {
  pass: PassPrompt,
  yesNo: YesNoPrompt,
};
