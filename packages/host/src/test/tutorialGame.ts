// Test helper (#699): a real first-deck tutorial game, played by fixed choices, seen as the learner's (LIO's) frames.
import { TUTORIAL_LESSONS, type Lesson } from "@terminal-dusk/content";
import { legalAnswers, pendingFor, SIDES, type AnswerValue, type Decision, type Side } from "@terminal-dusk/engine";
import { firstDeckRuleset } from "../firstDeck.ts";
import { hostCreate } from "../hostCreate.ts";
import { hostSubmit } from "../hostSubmit.ts";
import { tutorialConfig } from "../tutorial/config.ts";
import type { Frame } from "../types.ts";

/** Picks one of a decision's legal answers. */
export type Picker = (side: Side, decision: Decision, answers: AnswerValue[]) => AnswerValue;

/** Plays each card for its event when it can, else the first legal answer. */
export const eventsFirst: Picker = (_side, _decision, answers) =>
  answers.find((a) => a.kind === "playCardAs" && a.as === "event") ?? answers[0]!;

/** LIO plays cards for their points and tries the tech race whenever it may; otherwise as eventsFirst. */
export const racingLio: Picker = (side, decision, answers) => {
  if (side !== "lio") return eventsFirst(side, decision, answers);
  const race = answers.find((a) => a.kind === "chooseAction" && a.action === "techRace");
  const points = answers.find((a) => a.kind === "playCardAs" && a.as === "points");
  return race ?? points ?? answers[0]!;
};

/**
 * The learner's frame at each point of `lesson`'s game (the first bundled lesson by default), from the start, until
 * `limit` answers have been given.
 */
export function* learnerFrames(
  pick: Picker = eventsFirst,
  limit = 400,
  lesson: Lesson = TUTORIAL_LESSONS[0]!,
): Generator<Frame> {
  const created = hostCreate(firstDeckRuleset, tutorialConfig(lesson, "full"), "s", 0);
  if (!created.ok) throw new Error(created.error.code);
  let host = created.value;
  for (let i = 0; i < limit; i++) {
    yield host.frames.lio;
    const side = SIDES.find((s) => pendingFor(host.secret.state, s) !== null);
    if (side === undefined) return;
    const decision = pendingFor(host.secret.state, side)!;
    const value = pick(side, decision, legalAnswers(firstDeckRuleset, host.secret.state, side));
    const submission = {
      player: host.record.players[side],
      expectedSeq: host.record.seq,
      decisionId: decision.id,
      value,
    };
    const next = hostSubmit(firstDeckRuleset, host.record, host.secret, submission, 0);
    if (!next.ok) throw new Error(next.error.code);
    host = next.value;
  }
}

/** The first learner frame for which `found` holds, or a throw. */
export function learnerFrameWhere(found: (frame: Frame) => boolean, pick: Picker = eventsFirst): Frame {
  for (const frame of learnerFrames(pick)) if (found(frame)) return frame;
  throw new Error("The game never reached that frame.");
}

/** Whether a modifier made by `card` is in force in `frame`. */
export const inForce = (frame: Frame, card: string): boolean =>
  frame.view.public.modifiers.some((m) => m.source === card);
