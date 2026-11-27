// "Never stuck" (#641): a coach step may allow only answers the rules refuse right now (a country the points left
// can no longer pay for, say). Then the learner could do nothing, so the step lets every answer through instead.
import type { AnswerValue } from "@terminal-dusk/engine";
import type { TutorialOutput } from "./runner.ts";

/** `output`, with `allows` opened to every answer when none of `legal` passes it; otherwise `output` unchanged. */
export function neverStuck(output: TutorialOutput, legal: readonly AnswerValue[]): TutorialOutput {
  if (legal.length === 0 || legal.some((answer) => output.allows(answer))) return output;
  return { ...output, allows: () => true };
}
