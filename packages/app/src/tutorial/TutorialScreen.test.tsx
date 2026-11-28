import { TUTORIAL_LESSONS } from "@terminal-dusk/host";
import type { Lesson } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { flush } from "../vsAi/test/scriptedHuman.ts";
import { standInAi } from "../vsAi/test/standInAi.ts";
import { VsAiView } from "../vsAi/VsAiScreen.tsx";
import type { TutorialCoaching } from "./tutorialMatch.ts";
import { createTutorialSession } from "./tutorialSession.ts";
import { COACHING_OVER, PLACEHOLDER_LABEL, TutorialCoach } from "./TutorialScreen.tsx";

const clock = (): number => 1_700_000_000_000;
const placeholder = TUTORIAL_LESSONS.find((l) => l.id === "placeholder")!;
const coaching = (over: Partial<TutorialCoaching>): TutorialCoaching => ({
  text: null,
  chapter: null,
  style: null,
  allows: () => true,
  over: false,
  ...over,
});
const start = (lesson: Lesson = placeholder) => {
  const standIn = standInAi();
  const started = createTutorialSession({
    lesson,
    edition: "free",
    clock,
    newSeed: () => "tutorial-screen-seed",
    newAiSeed: () => 3,
    makeAi: standIn.makeAi,
  });
  return { ...started, standIn };
};

describe("the tutorial's coach corner", () => {
  it("shows the placeholder label while the lesson is a placeholder, with the chapter and the coach's words", () => {
    const out = renderToString(
      <TutorialCoach lesson={placeholder} coaching={coaching({ text: "Say", chapter: "One", style: "coach" })} />,
    );
    expect(out).toContain(`<p class="tutorial-label">${PLACEHOLDER_LABEL}</p>`);
    expect(out).toContain('<h2 class="coaching-chapter">One</h2>');
    expect(out).toContain('<p class="coaching-text">Say</p>');
  });
  it("has no placeholder label for a real lesson", () => {
    const real = { ...placeholder, placeholder: false };
    expect(renderToString(<TutorialCoach lesson={real} coaching={coaching({})} />)).not.toContain(PLACEHOLDER_LABEL);
  });
  it("says the coaching is over, and the game goes on, once the coaching ends", () => {
    const out = renderToString(<TutorialCoach lesson={placeholder} coaching={coaching({ over: true })} />);
    expect(out).toContain(`<p class="coaching-text">${COACHING_OVER}</p>`);
    expect(out).not.toContain("coaching-chapter");
  });
  it("shows the last chapter's words at the game's end when the final frame brought them (#701)", () => {
    const last = coaching({ text: "Era 1 scores.", chapter: "Scoring", style: "coach", over: true });
    const out = renderToString(<TutorialCoach lesson={placeholder} coaching={last} />);
    expect(out).toContain('<h2 class="coaching-chapter">Scoring</h2>');
    expect(out).toContain('<p class="coaching-text">Era 1 scores.</p>');
    expect(out).not.toContain(COACHING_OVER);
  });
});

describe("the tutorial session", () => {
  it("plays the lesson as LIO against the Easy AI, and needs no sign-in or entitlement", async () => {
    const { session, match, standIn } = start();
    await flush();
    expect(match).not.toBeNull();
    expect(session.getSnapshot().human).toBe("lio");
    expect(session.getSnapshot().tier).toBe("easy");
    expect(standIn.tiers).toEqual(["easy"]);
    expect(session.getSnapshot().refusal).toBeNull();
    session.stop();
  });

  it("coaches, then hints, then ends the coaching while the game goes on", async () => {
    const { session, match } = start();
    const seen: string[] = [];
    let accepted = 0;
    for (let step = 0; step < 300; step++) {
      await flush();
      const c = match!.coaching();
      if (c.over) seen.push("over");
      else if (c.style !== null && c.text !== null) seen.push(`${c.style}: ${c.text}`);
      if (seen.at(-1) === "over" && accepted > 0) break;
      const frame = session.getSnapshot().frame;
      if (!frame?.decision) continue;
      const value = match!.legalAnswers("lio").find((a) => c.allows(a));
      if (value === undefined) throw new Error("the learner is stuck");
      const before = frame.seq;
      await session.answer(value);
      expect(session.getSnapshot().refusal).toBeNull();
      if (seen.at(-1) === "over" && session.getSnapshot().frame!.seq !== before) accepted++;
    }
    expect([...new Set(seen)]).toEqual([
      `coach: ${placeholder.chapters[0]!.steps[0]!.say}`,
      `hint: ${placeholder.chapters[1]!.steps[0]!.say}`,
      "over",
    ]);
    expect(session.getSnapshot().frame!.view.public.status.kind).toBe("active");
    expect(accepted).toBeGreaterThan(0);
    session.stop();
  });

  it("draws the coach over the game and greys out a choice the coach refuses", async () => {
    const { session } = start();
    await flush();
    const snapshot = session.getSnapshot();
    const out = renderToString(
      <VsAiView
        snapshot={snapshot}
        session={session}
        onNewGame={() => {}}
        allows={() => false}
        coach={<p className="tutorial-coach">coach here</p>}
      />,
    );
    expect(out).toContain('<p class="tutorial-coach">coach here</p>');
    expect(snapshot.frame?.decision).toBeTruthy();
    expect(out).toMatch(/<button[^>]*disabled/);
    expect(renderToString(<VsAiView snapshot={snapshot} session={session} onNewGame={() => {}} />)).not.toContain(
      "tutorial-coach",
    );
    session.stop();
  });
});
