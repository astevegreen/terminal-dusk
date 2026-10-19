// Test helper: a human who always presses the first button of the prompt on screen, and a loop that plays a
// vs-AI session to the end with them.
import { createElement } from "react";
import { decisionPrompts } from "../../decisionPrompts.tsx";
import { cardName } from "../../testMode/fixture.ts";
import { buttonsOf } from "../../testMode/promptTree.ts";
import type { VsAiSession } from "../session.ts";
import type { StandIn } from "./standInAi.ts";

/** Lets every pending promise and timer callback run. */
export const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Presses the first button of the human's prompt that the host accepts (the fixture's prompts offer some moves
 * the rules refuse), waiting after each press for the answer to be handled.
 */
export async function pressFirst(session: VsAiSession): Promise<void> {
  const frame = session.getSnapshot().frame;
  const decision = frame?.decision;
  if (!frame || !decision) throw new Error("the human has nothing to answer");
  const buttons = buttonsOf(
    createElement(decisionPrompts[decision.kind], {
      decision,
      hand: frame.view.mine?.hand ?? [],
      label: cardName,
      onAnswer: (value) => void session.answer(value),
    }),
  );
  for (const button of buttons) {
    button.click();
    await flush();
    if (session.getSnapshot().frame?.seq !== frame.seq) return;
  }
  throw new Error(`every button of the ${decision.kind} prompt was refused`);
}

/**
 * Plays until the game is over or the AI is refused: the human answers when asked, otherwise held AI replies
 * are released. `beforeRelease` runs once, before anything is released (to answer first while the AI thinks).
 */
export async function playOut(session: VsAiSession, standIn: StandIn, beforeRelease?: () => Promise<void>) {
  if (beforeRelease) await beforeRelease();
  for (let step = 0; step < 200; step++) {
    await flush();
    const snapshot = session.getSnapshot();
    if (snapshot.frame?.view.public.status.kind !== "active" || snapshot.aiRefusal) return;
    if (snapshot.frame.decision) await pressFirst(session);
    else if (standIn.release() === 0) throw new Error("nobody can move");
  }
  throw new Error("the game did not end within 200 steps");
}
