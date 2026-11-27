// Test helper: a learner who plays the tutorial's game, answering only what the coach allows.
import { expect } from "vitest";
import { flush } from "../../vsAi/test/scriptedHuman.ts";
import type { TutorialSession } from "../tutorialSession.ts";

export const pub = (s: TutorialSession) => s.session.getSnapshot().frame!.view.public;

/** Answers for LIO, as the coach allows, until `done` says stop; fails if the game never gets there. */
export async function playUntil(started: TutorialSession, done: (s: TutorialSession) => boolean): Promise<void> {
  const { session, match } = started;
  for (let step = 0; step < 2000; step++) {
    await flush();
    if (done(started)) return;
    const frame = session.getSnapshot().frame;
    if (!frame?.decision) continue;
    const coaching = match!.coaching();
    const value = match!.legalAnswers("lio").find((a) => coaching.allows(a));
    if (value === undefined) throw new Error("the learner is stuck");
    await session.answer(value);
    expect(session.getSnapshot().refusal).toBeNull();
  }
  throw new Error("the game never got there");
}
