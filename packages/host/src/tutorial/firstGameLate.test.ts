// The real tutorial lesson's chapters 5-7 and its asides (#701; docs/design/tutorial.md, "Coaching words"), played
// through a real first-deck tutorial game (test/playLesson.ts).
import { TUTORIAL_LESSONS, type Lesson } from "@terminal-dusk/content";
import { techRaceCost, type GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { playLesson, type Played, type Showing } from "../test/playLesson.ts";
import { eventsFirst, type Picker } from "../test/tutorialGame.ts";
import type { Frame } from "../types.ts";

const lesson = TUTORIAL_LESSONS.find((l) => l.id === "first-game") as Lesson;
const game = playLesson(lesson);

const text = (g: Played, step: string) => g.lines.find((l) => l.step === step)!.text;
/** What the learner could answer at the first `decision` asked while `step` showed. */
const at = (g: Played, step: string, decision: string): Showing => {
  const found = g.asked.find((a) => a.step === step && a.decision === decision);
  if (found === undefined) throw new Error(`No ${decision} while ${step} showed.`);
  return found;
};
const only = (g: Played, step: string, decision: string, answer: string) => {
  const shown = at(g, step, decision);
  expect(shown.allowed, step).toEqual([answer]);
  expect(shown.legal.length, step).toBeGreaterThan(1);
};

describe("chapter 5, Escalation and realigning", () => {
  it("shows the Escalation line and the Budapest Memorandum line together, its points from the game", () => {
    const [escalation, budapest] = text(game, "escalation-realign/0").split("\n\n");
    expect(escalation).toMatch(/^Escalation runs from 0 to 6\. .* drops back to 3\.$/);
    expect(budapest).toBe(
      "Play Budapest Memorandum for its 2 points and realign: each point is one attempt, on a country where SAE has " +
        "influence, in a region that is still open.",
    );
  });

  it("allows Budapest Memorandum for its points, then realigning only", () => {
    only(game, "escalation-realign/0", "playCardAs", "playCardAs e1-lio-002 points");
    only(game, "escalation-realign/1", "chooseAction", "chooseAction realign");
    expect(text(game, "escalation-realign/1")).toMatch(/^Both sides draw\. .* gives it \+1\.$/);
  });
});

describe("chapter 6, the tech race", () => {
  it("allows Arrest of Aldrich Ames, Second Chechen War for its points, its event after, then the tech race", () => {
    only(game, "tech-race/0", "chooseCard", "chooseCard e1-lio-010");
    only(game, "tech-race/1", "playCardAs", "playCardAs e1-sae-004 points");
    only(game, "tech-race/2", "rivalEventOrder", "rivalEventOrder after");
    only(game, "tech-race/3", "chooseAction", "chooseAction techRace");
  });

  it("fills the card's event and points from the game", () => {
    expect(text(game, "tech-race/1")).toMatch(/would give SAE \d+ points? and raise Escalation\./);
    expect(text(game, "tech-race/2")).toContain(
      "All 3 points go to this one try, so any above the cost are lost. Draw: on 4 or more",
    );
  });

  it("the last play's hint never limits the answers", () => {
    const hint = at(game, "tech-race/4", "playCardAs");
    expect(hint.allowed).toEqual(hint.legal);
    expect(text(game, "tech-race/4")).toBe(
      "Your last play before Era 1 scores: look for regions where you are close to present or ahead.",
    );
  });
});

describe("chapter 6 when Second Chechen War can't pay the step", () => {
  /** From turn 3, the learner sees SAE holding Quantum Computing: pulling it back costs 4, more than the card's 3. */
  const quantum = (f: Frame): Frame => {
    const pub = f.view.public;
    if (pub.turn < 3 || pub.techRace === undefined) return f;
    const marker = [4, -4].find(
      (m) => techRaceCost({ ...pub, techRace: { ...pub.techRace!, marker: m } }, "lio") === 4,
    )!;
    return { ...f, view: { ...f.view, public: { ...pub, techRace: { ...pub.techRace, marker } } } };
  };
  const cantPay = playLesson(lesson, undefined, quantum);

  it("says the points can't pay the cost, and coaches placing influence instead of the tech race", () => {
    expect(text(cantPay, "tech-race/1")).toMatch(
      /^Your 3 points can't pay this step's cost of 4 this turn\. Play Second Chechen War for its points and place influence instead: its event, SAE's, still happens\. Played this way, its event gives SAE \d+ points? and raises Escalation\. Points spent on the tech race would have cancelled it\.$/,
    );
    expect(text(cantPay, "tech-race/2")).not.toContain("this one try");
    const action = at(cantPay, "tech-race/3", "chooseAction");
    expect(action.allowed).toEqual(["chooseAction place"]);
    expect(action.legal.length).toBeGreaterThan(1);
  });

  it("lets the learner put the event before or after the points, since there is no try to cancel it", () => {
    const order = at(cantPay, "tech-race/2", "rivalEventOrder");
    expect(order.allowed).toEqual(order.legal);
  });
});

describe("chapter 6 in a real game where Second Chechen War can't pay the step (the design doc's example)", () => {
  /**
   * SAE plays Battle of Mogadishu for its event on turn 2 ("intervention fatigue"), tries the tech race whenever it
   * may, and opens turn 3 with Rwandan Genocide. From this seed both tries succeed: SAE holds AI, so pulling it back
   * costs 2, and Rwandan Genocide leaves Second Chechen War 1 point.
   */
  const saeAheadOnAi = (): Picker => {
    let openings = 0;
    return (side, decision, answers) => {
      if (side !== "sae") return eventsFirst(side, decision, answers);
      const kept = (a: (typeof answers)[number]) => !("card" in a) || !["e1-neu-001", "e1-sae-001"].includes(a.card);
      if (decision.kind === "chooseCard") {
        if (++openings === 3) return answers.find((a) => "card" in a && a.card === "e1-neu-001")!;
        return answers.find(kept)!;
      }
      const mogadishu = answers.find((a) => a.kind === "playCardAs" && a.card === "e1-sae-001" && a.as === "event");
      if (openings === 2 && mogadishu !== undefined) return mogadishu;
      const race = answers.find((a) => a.kind === "chooseAction" && a.action === "techRace");
      const points = answers.find((a) => a.kind === "playCardAs" && a.as === "points" && kept(a));
      return race ?? points ?? answers[0]!;
    };
  };
  let seenCost: number | null = null;
  let seenMarker: number | undefined;
  const real = playLesson(
    lesson,
    saeAheadOnAi(),
    (f) => {
      const pub = f.view.public;
      if (pub.turn === 3 && f.decision?.kind === "playCardAs" && seenMarker === undefined) {
        seenMarker = pub.techRace?.marker;
        seenCost = techRaceCost(pub, "lio");
      }
      return f;
    },
    "seed-0",
  );

  it("reaches the step: SAE holds AI, so the try costs 2, more than the card's 1 point", () => {
    expect(seenMarker).toBe(2);
    expect(seenCost).toBe(2);
  });

  it("shows the can't-pay lines with the live numbers", () => {
    expect(text(real, "tech-race/1")).toBe(
      "Your 1 point can't pay this step's cost of 2 this turn. Play Second Chechen War for its points and place " +
        "influence instead: its event, SAE's, still happens. Played this way, its event gives SAE 1 point and raises " +
        "Escalation. Points spent on the tech race would have cancelled it.",
    );
    expect(text(real, "tech-race/2")).toBe(
      "One shared marker starts at parity. Moving it toward your side costs 1 for Networks and Orbit, 2 for AI, 3 " +
        "for Hypersonics and 4 for Quantum Computing. Pulling SAE's lead back costs what SAE's step cost. Draw: on 4 " +
        "or more, the marker moves one step. Each side may try once per turn.",
    );
  });

  it("allows placing influence, and not the tech race", () => {
    const action = at(real, "tech-race/3", "chooseAction");
    expect(action.allowed).toEqual(["chooseAction place"]);
    expect(action.legal.length).toBeGreaterThan(1);
  });
});

describe("chapter 7, scoring, winning and the abilities", () => {
  it("shows its four lines together when Era 1 scores, then the coaching ends", () => {
    const lines = text(game, "scoring/0").split("\n\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(/^Era 1 is over, and every region scores in turn\./);
    expect(lines[1]).toMatch(/The track started 7 steps towards SAE\.$/);
    expect(lines[2]).toMatch(/^LIO's ability, Resilient institutions:/);
    expect(lines[3]).toBe("That's the coaching. From here it's a normal game.");
    expect(game.over).toBe(true);
  });
});

describe("the ability asides", () => {
  const bonus: GameEvent = { kind: "abilityBonus", visibility: "public", side: "sae", amount: 1 };
  const redraw: GameEvent = { kind: "abilityRedraw", visibility: "public", side: "lio", deck: "lio", setAside: 1 };
  /** `event` added to the learner's first frame for which `when` holds. */
  const withEvent = (event: GameEvent, when: (f: Frame) => boolean) => {
    let done = false;
    return (f: Frame): Frame => {
      if (done || !when(f)) return f;
      done = true;
      return { ...f, events: [...f.events, event] };
    };
  };

  it("shows from its event until the first step of the next chapter shows", () => {
    const g = playLesson(
      lesson,
      undefined,
      withEvent(bonus, (f) => f.decision?.kind === "chooseCard" && f.view.public.turn === 3),
    );
    const from = g.asides.findIndex((a) => a.aside !== null);
    expect(g.asides[from]!.aside).toBe(
      "Unified command: SAE's card played for points counted 1 more. Chapter 7 explains.",
    );
    const shown = g.asides.slice(from).filter((a) => a.aside !== null);
    expect(shown.every((a) => a.step?.startsWith("tech-race/") ?? true)).toBe(true);
    expect(g.asides.find((a) => a.step === "scoring/0")!.aside).toBeNull();
  });

  it("shows Resilient institutions' line when its redraw comes before chapter 7", () => {
    const g = playLesson(
      lesson,
      undefined,
      withEvent(redraw, (f) => f.decision?.kind === "chooseCard" && f.view.public.turn === 3),
    );
    expect(g.asides.find((a) => a.aside !== null)!.aside).toBe(
      "Resilient institutions set your 1 aside, and you drew again. Chapter 7 explains.",
    );
  });

  it("shows neither ability's line once chapter 7 has started", () => {
    for (const event of [redraw, bonus]) {
      const g = playLesson(
        lesson,
        undefined,
        withEvent(event, (f) => f.view.public.turn === 4),
      );
      expect(
        g.asides.every((a) => a.aside === null),
        event.kind,
      ).toBe(true);
    }
  });

  it("never shows once chapter 7 has started", () => {
    const g = playLesson(
      lesson,
      undefined,
      withEvent(redraw, (f) => f.view.public.turn === 4),
    );
    expect(g.asides.every((a) => a.aside === null)).toBe(true);
  });
});
