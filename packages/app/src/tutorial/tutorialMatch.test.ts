import { TUTORIAL_LESSONS, type Frame, type Lesson } from "@terminal-dusk/host";
import type { AnswerValue, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { createTutorialMatch, type TutorialMatch } from "./tutorialMatch.ts";

const SEED = "tutorial-match-1";
const clock = (): number => 1_700_000_000_000;
const placeholder = TUTORIAL_LESSONS.find((l) => l.id === "placeholder")!;
/** The first step of `chapter`, its lines joined as the coaching panel shows them. */
const sayOf = (lesson: Lesson, chapter: number): string =>
  [lesson.chapters[chapter]!.steps[0]!.say].flat().join("\n\n");

function make(lesson: Lesson): TutorialMatch {
  const made = createTutorialMatch(lesson, "full", SEED, clock);
  if (!made.ok) throw new Error(made.error.code);
  return made.value;
}

/** The latest frame each player's transport has delivered. */
function watch(match: TutorialMatch): Record<Side, () => Frame> {
  const latest = {} as Record<Side, Frame>;
  for (const side of ["lio", "sae"] as const) match.transportFor(side).subscribe((f) => (latest[side] = f));
  return { lio: () => latest.lio, sae: () => latest.sae };
}

/** Plays the first legal answer for whoever waits, until LIO has a playCardAs decision. */
async function untilLioPlays(match: TutorialMatch, frames: Record<Side, () => Frame>): Promise<void> {
  for (let n = 0; n < 200; n++) {
    if (frames.lio().decision?.kind === "playCardAs") return;
    const side: Side = frames.lio().decision !== null ? "lio" : "sae";
    const frame = frames[side]();
    if (frame.decision === null) throw new Error("nothing waits while the game is active");
    const value = match.legalAnswers(side).find((a) => match.coaching().allows(a) || side === "sae")!;
    const sent = await match
      .transportFor(side)
      .submit({ decisionId: frame.decision.id, expectedSeq: frame.seq, value });
    if (!sent.ok) throw new Error(sent.error.code);
  }
  throw new Error("LIO never had a card to play");
}

/** The placeholder lesson with its coach step limited to playing one card. */
function onlyCard(card: string): Lesson {
  const lesson = structuredClone(placeholder);
  lesson.chapters[0]!.steps[0]!.allow = [{ kind: "playCardAs", card }];
  return lesson;
}

/** LIO's hand at its first card play in the placeholder game (the same seed, so the same hand). */
async function firstHand(): Promise<string[]> {
  const match = make(placeholder);
  const frames = watch(match);
  await untilLioPlays(match, frames);
  return [...(frames.lio().view.mine?.hand ?? [])];
}

const cardOf = (a: AnswerValue): string | undefined => (a as { card?: string }).card;

describe("the tutorial match (#641)", () => {
  it("refuses an answer the coach step does not allow, and the game does not change", async () => {
    const [allowedCard] = await firstHand();
    const match = make(onlyCard(allowedCard!));
    const frames = watch(match);
    await untilLioPlays(match, frames);
    const before = frames.lio();
    const other = match.legalAnswers("lio").find((a) => a.kind === "playCardAs" && cardOf(a) !== allowedCard)!;
    expect(other, "LIO has another card it could play").toBeDefined();
    const refused = await match
      .transportFor("lio")
      .submit({ decisionId: before.decision!.id, expectedSeq: before.seq, value: other });
    expect(refused).toEqual({ ok: false, error: { code: "notInLesson" } });
    expect(frames.lio(), "no new frame: the host never saw the answer").toBe(before);
    expect(match.legalAnswers("lio")).toContainEqual(other);
  });

  it("does not strand the learner when the step names a card LIO does not hold: every answer goes through", async () => {
    const hand = await firstHand();
    const notHeld = placeholder.deckTop.find((card) => !hand.includes(card));
    expect(notHeld, "a stacked card LIO does not hold").toBeDefined();
    const match = make(onlyCard(notHeld!));
    const frames = watch(match);
    await untilLioPlays(match, frames);
    const before = frames.lio();
    const legal = match.legalAnswers("lio");
    expect(
      legal.every((a) => match.coaching().allows(a)),
      "every legal answer is allowed",
    ).toBe(true);
    const sent = await match
      .transportFor("lio")
      .submit({ decisionId: before.decision!.id, expectedSeq: before.seq, value: legal[0]! });
    expect(sent.ok).toBe(true);
    expect(frames.lio().seq).toBeGreaterThan(before.seq);
  });

  it("lets an answer the coach step allows go through to the host", async () => {
    const [allowedCard] = await firstHand();
    const match = make(onlyCard(allowedCard!));
    const frames = watch(match);
    await untilLioPlays(match, frames);
    const before = frames.lio();
    const allowed = match.legalAnswers("lio").find((a) => a.kind === "playCardAs" && cardOf(a) === allowedCard)!;
    expect(match.coaching().allows(allowed)).toBe(true);
    const sent = await match
      .transportFor("lio")
      .submit({ decisionId: before.decision!.id, expectedSeq: before.seq, value: allowed });
    expect(sent).toEqual({ ok: true });
    expect(frames.lio().seq).toBeGreaterThan(before.seq);
  });

  it("sends a stale answer on to the host, which refuses it with its own code", async () => {
    const [allowedCard] = await firstHand();
    const match = make(onlyCard(allowedCard!));
    const frames = watch(match);
    await untilLioPlays(match, frames);
    const before = frames.lio();
    const other = match.legalAnswers("lio").find((a) => a.kind === "playCardAs" && cardOf(a) !== allowedCard)!;
    const sent = await match
      .transportFor("lio")
      .submit({ decisionId: before.decision!.id, expectedSeq: before.seq - 1, value: other });
    expect(sent.ok).toBe(false);
    if (!sent.ok) expect(sent.error.code).not.toBe("notInLesson");
  });

  it("the coaching follows the lesson's steps: the coach step, then the hint, then nothing once it is over", async () => {
    const match = make(placeholder);
    const frames = watch(match);
    let told = 0;
    match.subscribeCoaching(() => told++);
    await untilLioPlays(match, frames);
    expect(match.coaching()).toMatchObject({
      text: sayOf(placeholder, 0),
      chapter: placeholder.chapters[0]!.title,
      style: "coach",
      over: false,
    });
    const first = frames.lio();
    const play = match.legalAnswers("lio").find((a) => match.coaching().allows(a))!;
    await match.transportFor("lio").submit({ decisionId: first.decision!.id, expectedSeq: first.seq, value: play });
    await untilLioPlays(match, frames);
    expect(match.coaching()).toMatchObject({
      text: sayOf(placeholder, 1),
      chapter: placeholder.chapters[1]!.title,
      style: "hint",
    });
    expect(
      match.legalAnswers("lio").every((a) => match.coaching().allows(a)),
      "a hint never limits",
    ).toBe(true);
    const second = frames.lio();
    const any = match.legalAnswers("lio")[0]!;
    await match.transportFor("lio").submit({ decisionId: second.decision!.id, expectedSeq: second.seq, value: any });
    await untilLioPlays(match, frames);
    expect(match.coaching()).toMatchObject({ text: null, chapter: null, over: true });
    expect(told, "listeners hear each new frame").toBeGreaterThan(2);
  });

  it("a listener that stops hears nothing more, and one that throws keeps the others hearing", async () => {
    const match = make(placeholder);
    const frames = watch(match);
    let stopped = 0;
    let kept = 0;
    const stop = match.subscribeCoaching(() => stopped++);
    match.subscribeCoaching(() => {
      throw new Error("a broken listener");
    });
    match.subscribeCoaching(() => kept++);
    stop();
    await untilLioPlays(match, frames);
    expect(stopped).toBe(0);
    expect(kept).toBeGreaterThan(0);
  });
});
