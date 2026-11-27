import { lessonSchema, type Lesson } from "@terminal-dusk/content";
import type { AnswerValue, Decision, GameEvent, PlayerView } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { firstDeckRuleset } from "../firstDeck.ts";
import { deepFreeze } from "../test/deepFreeze.ts";
import type { Frame } from "../types.ts";
import { startTutorial, stepTutorial, type TutorialRunner } from "./runner.ts";

type FrameParts = {
  decision?: Decision | null;
  events?: GameEvent[];
  turn?: number;
  hand?: string[];
  over?: boolean;
};
/** A learner's (LIO's) frame with only the parts the runner reads. */
const frame = (parts: FrameParts = {}): Frame => {
  const view = {
    public: {
      turn: parts.turn ?? 1,
      status: parts.over ? { kind: "over", winner: "lio", reason: "score" } : { kind: "active" },
    },
    mine: { hand: parts.hand ?? ["e1-lio-001", "e1-sae-001"], picks: [], knowledge: [] },
  } as unknown as PlayerView;
  return {
    matchId: "m",
    seq: 1,
    viewer: "lio",
    ruleset: firstDeckRuleset.id,
    view,
    events: parts.events ?? [],
    decision: parts.decision ?? null,
  };
};
const decision = (
  kind: Decision["kind"],
  options: Decision["options"] = {},
  side: "lio" | "sae" = "lio",
): Decision => ({
  id: `d-${kind}`,
  side,
  kind,
  options,
});
const playDecision = decision("playCardAs", {
  from: "hand",
  uses: { own: ["event", "points"], rival: ["event", "points"], neutral: ["event", "points"] },
});
const placed: GameEvent = { kind: "influencePlaced", visibility: "public", side: "lio", country: "france", cost: 1 };

const lesson: Lesson = lessonSchema.parse({
  id: "lesson-test",
  title: "Test lesson",
  placeholder: true,
  deckTop: [],
  chapters: [
    {
      id: "ch1",
      title: "Opening",
      steps: [
        { when: { start: true }, say: "Welcome.", until: { decision: "playCardAs", side: "lio" } },
        {
          when: { decision: "playCardAs", side: "lio", turn: 1 },
          say: "Play the first card for its points.",
          allow: [{ kind: "playCardAs", card: "e1-lio-001", as: "points" }],
          until: { event: "influencePlaced", side: "lio" },
        },
      ],
    },
    {
      id: "ch2",
      title: "Placing",
      steps: [
        {
          when: { decision: "placeInfluence" },
          say: "Place in France.",
          allow: [{ kind: "placeInfluence", country: "france" }],
        },
        { when: { event: "scoreChanged" }, say: "Points!", style: "hint" },
      ],
    },
  ],
});

/** Runs the frames in order, returning every output. */
const run = (frames: Frame[], start: TutorialRunner = startTutorial(lesson)) => {
  let runner = start;
  return frames.map((f) => {
    const out = stepTutorial(runner, f);
    runner = out.runner;
    return out;
  });
};
const playPoints: AnswerValue = { kind: "playCardAs", card: "e1-lio-001", as: "points" };
const playEvent: AnswerValue = { kind: "playCardAs", card: "e1-lio-001", as: "event" };
const scored: GameEvent = { kind: "scoreChanged", visibility: "public", from: 0, to: 1 };
/** The frames that take the test lesson through its playCardAs step. */
const toPlay = [frame(), frame({ decision: playDecision })];
const placeDecision = decision("placeInfluence", { points: 2, countries: ["france", "germany"] });

describe("tutorial runner", () => {
  it("shows coaching when its trigger is in the frame, and only then", () => {
    const outs = run([frame(), frame({ decision: playDecision })]);
    expect(outs.map((o) => o.coaching)).toEqual(["Welcome.", "Play the first card for its points."]);
    expect(outs[1]!.chapter).toEqual({ id: "ch1", title: "Opening" });
    expect(outs[1]!.style).toBe("coach");
    const placeFirst = run([...toPlay, frame({ events: [placed] }), frame()]);
    expect(placeFirst[3]!.coaching).toBeNull();
    expect(run([...toPlay, frame({ events: [placed] }), frame({ decision: placeDecision })])[3]!.coaching).toBe(
      "Place in France.",
    );
  });
  it("matches a trigger's side and turn against the decision and the public turn", () => {
    const wrongTurn = run([frame(), frame({ decision: playDecision, turn: 2 })]);
    expect(wrongTurn[1]!.coaching).toBeNull();
    const rivalsEvent: GameEvent = {
      kind: "influencePlaced",
      visibility: "public",
      side: "sae",
      country: "france",
      cost: 1,
    };
    expect(run([...toPlay, frame({ events: [rivalsEvent] })])[2]!.coaching).toBe("Play the first card for its points.");
  });

  it("refuses answers outside the step's allow", () => {
    const out = run(toPlay)[1]!;
    expect(out.allows(playPoints)).toBe(true);
    expect(out.allows(playEvent)).toBe(false);
    expect(out.allows({ kind: "playCardAs", card: "e1-sae-001", as: "points" })).toBe(false);
  });
  it("allows any legal answer when the step has no allow, or a hint step is showing", () => {
    const welcome = run([frame({ decision: decision("chooseCard", { from: "hand" }) })])[0]!;
    expect(welcome.allows({ kind: "chooseCard", card: "e1-sae-001" })).toBe(true);
    const hint = run([
      ...toPlay,
      frame({ events: [placed] }),
      frame({ decision: placeDecision }),
      frame({ events: [scored] }),
    ]);
    expect(hint[4]!.style).toBe("hint");
    expect(hint[4]!.allows({ kind: "placeInfluence", country: "germany" })).toBe(true);
  });
  it("limits only answers of a matcher's own kind", () => {
    const out = run(toPlay)[1]!;
    expect(out.allows({ kind: "yesNo", yes: false })).toBe(true);
  });

  it("never leaves the learner stuck: with no offered option matching, any answer is allowed", () => {
    const noCard = run([frame(), frame({ decision: playDecision, hand: ["e1-sae-001"] })])[1]!;
    expect(noCard.coaching).toBe("Play the first card for its points.");
    expect(noCard.allows({ kind: "playCardAs", card: "e1-sae-001", as: "event" })).toBe(true);
    const eventOnly = decision("playCardAs", {
      from: "hand",
      uses: { own: ["event"], rival: ["event"], neutral: ["event"] },
    });
    expect(run([frame(), frame({ decision: eventOnly })])[1]!.allows(playEvent)).toBe(true);
    const at = [...toPlay, frame({ events: [placed] })];
    const noFrance = run([
      ...at,
      frame({ decision: decision("placeInfluence", { points: 1, countries: ["germany"] }) }),
    ])[3]!;
    expect(noFrance.allows({ kind: "placeInfluence", country: "germany" })).toBe(true);
    const france = run([...at, frame({ decision: placeDecision })])[3]!;
    expect(france.allows({ kind: "placeInfluence", country: "germany" })).toBe(false);
  });
  it("never limits a discardCards decision", () => {
    const discardLesson = lessonSchema.parse({
      ...lesson,
      chapters: [
        {
          id: "c",
          title: "C",
          steps: [
            {
              when: { decision: "discardCards" },
              say: "Discard.",
              allow: [{ kind: "discardCards", card: "e1-lio-001" }],
            },
          ],
        },
      ],
    });
    const discard = decision("discardCards", { from: "hand", count: 1 });
    const out = run([frame({ decision: discard })], startTutorial(discardLesson))[0]!;
    expect(out.coaching).toBe("Discard.");
    expect(out.allows({ kind: "discardCards", cards: ["e1-sae-001"] })).toBe(true);
  });
  it("checks chooseAction's offered actions and an intervention's targets", () => {
    const actLesson = lessonSchema.parse({
      ...lesson,
      chapters: [
        {
          id: "c",
          title: "C",
          steps: [
            {
              when: { decision: "chooseAction" },
              say: "Intervene in Iran.",
              allow: [{ kind: "chooseAction", action: "intervene", country: "iran" }],
            },
          ],
        },
      ],
    });
    const offered = decision("chooseAction", { points: 3, actions: ["place", "intervene", "pass"], targets: ["iran"] });
    const out = run([frame({ decision: offered })], startTutorial(actLesson))[0]!;
    expect(out.allows({ kind: "chooseAction", action: "intervene", country: "iran" })).toBe(true);
    expect(out.allows({ kind: "chooseAction", action: "place" })).toBe(false);
    const elsewhere = decision("chooseAction", { points: 3, actions: ["place", "intervene"], targets: ["iraq"] });
    expect(
      run([frame({ decision: elsewhere })], startTutorial(actLesson))[0]!.allows({
        kind: "chooseAction",
        action: "place",
      }),
    ).toBe(true);
  });

  it("checks the next step's trigger in the frame where a step's until fires", () => {
    const same = run([...toPlay, frame({ events: [placed], decision: placeDecision })]);
    expect(same[2]!.coaching).toBe("Place in France.");
    expect(same[2]!.chapter).toEqual({ id: "ch2", title: "Placing" });
  });
  it("sets coachingOver after the last chapter's last step", () => {
    const outs = run([
      ...toPlay,
      frame({ events: [placed] }),
      frame({ decision: placeDecision }),
      frame({ events: [scored] }),
      frame(),
    ]);
    expect(outs.map((o) => o.coachingOver)).toEqual([false, false, false, false, false, true]);
  });
  it("sets coachingOver when the game is over", () => {
    const out = run([frame(), frame({ decision: playDecision, over: true })])[1]!;
    expect(out.coachingOver).toBe(true);
  });
  it("gives no coaching and allows every answer after coachingOver", () => {
    const outs = run([frame(), frame({ over: true }), frame({ decision: playDecision })]);
    for (const out of outs.slice(1)) {
      expect(out).toMatchObject({ coaching: null, chapter: null, style: null, coachingOver: true });
      expect(out.allows(playEvent)).toBe(true);
    }
  });

  it("does not mutate its input frame or runner, and keeps its state plain JSON", () => {
    const start = deepFreeze(startTutorial(lesson));
    const f = deepFreeze(frame({ decision: playDecision }));
    const out = stepTutorial(stepTutorial(start, deepFreeze(frame())).runner, f);
    expect(JSON.parse(JSON.stringify(out.runner))).toEqual(out.runner);
    expect(JSON.parse(JSON.stringify(start))).toEqual(start);
  });
});
