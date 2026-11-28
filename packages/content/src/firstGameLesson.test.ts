// The real tutorial lesson (#700, #701) against docs/design/tutorial.md: its first cards, and every coaching
// line word for word, with its slots filled from the design doc's own example numbers.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Lesson } from "../schema/tutorial.ts";
import { splitLine } from "../schema/tutorialLines.ts";
import { TUTORIAL_LESSONS } from "./tutorialLessons.ts";

const doc = readFileSync(new URL("../../../docs/design/tutorial.md", import.meta.url), "utf8")
  .replace(/\s*\n\s*/g, " ")
  .replace(/ {2,}/g, " ");

/** The part of the design doc between two headings, with its line breaks joined. */
const section = (from: string, to: string): string => {
  const start = doc.indexOf(from);
  const end = doc.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`The design doc has no section "${from}".`);
  return doc.slice(start, end);
};
/** Every "quoted" text in `text`, in order. */
const quotes = (text: string): string[] => [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);

/** Whether `fragment` is in the design doc, so a variant built from it uses only approved words. */
const approved = (fragment: string): string => {
  expect(doc).toContain(fragment);
  return fragment;
};

/** The design doc's own example numbers and places for each slot these chapters use. */
const EXAMPLE: Record<string, string> = {
  "eventPoints:e1-lio-001": "1",
  "influenceIn:lio": "Taiwan",
  "homeNeighbours:lio": "Mexico, Cuba, Canada",
  "cardPoints:e1-lio-004": "4",
  "pointsBefore:e1-sae-008": "1",
  "pointsAfter:e1-sae-008": "2",
  "modifierTakesOff:e1-neu-001": "1",
  "cardPoints:e1-lio-006": "4",
  "cardPoints:e1-lio-002": "2",
  "eventPoints:e1-sae-004": "2",
  "cardPoints:e1-sae-004": "3",
};

/**
 * `say` with each slot filled from `values`; a slot with no value throws; several lines are joined as the host joins them. As the host does, " point" or " points"
 * after a filled number reads "point" after 1 and "points" otherwise (owner, 27 Nov 2026, #701).
 */
const fill = (say: string | readonly string[], values: Record<string, string> = EXAMPLE): string => {
  if (typeof say !== "string") return say.map((line) => fill(line, values)).join("\n\n");
  const split = splitLine(say);
  if ("error" in split) throw new Error(split.error);
  let previous = "";
  return split.pieces
    .map((p) => {
      if (!("slot" in p)) {
        const text = /^\d+$/.test(previous)
          ? p.text.replace(/^ points?\b/, previous === "1" ? " point" : " points")
          : p.text;
        previous = text;
        return text;
      }
      const value = values[`${p.slot}:${p.arg}`];
      if (value === undefined) throw new Error(`No example value for {${p.slot}:${p.arg}}.`);
      previous = value;
      return value;
    })
    .join("");
};

const lesson = TUTORIAL_LESSONS.find((l) => l.id === "first-game") as Lesson;
const steps = lesson.chapters.flatMap((c) => c.steps);
/** Each line a step says, a step that says several giving each in order (#701). */
const said = (say: string | readonly string[]): readonly string[] => (typeof say === "string" ? [say] : say);
const step = (chapter: string, index: number) => lesson.chapters.find((c) => c.id === chapter)!.steps[index]!;
const variantSays = (chapter: string, index: number) => (step(chapter, index).variants ?? []).map((v) => v.say);

describe("the first-game lesson's place among the bundled lessons (#700, #701)", () => {
  it("comes first, so the app plays it, and is no longer marked placeholder now its chapters are written (#701)", () => {
    expect(TUTORIAL_LESSONS.map((l) => l.id)).toEqual(["first-game", "placeholder"]);
    expect(lesson.placeholder).toBe(false);
    expect(lesson.title).toBe("Your first game");
  });
});

describe("its first cards", () => {
  it("are the 16 cards of 'Cards dealt first', in that order", () => {
    const dealt = section("## Cards dealt first", "## Coaching words");
    const cards = [...dealt.matchAll(/e1-(?:lio|sae|neu)-\d{3}/g)].map((m) => m[0]);
    expect(cards).toHaveLength(16);
    expect(lesson.deckTop).toEqual(cards);
  });
});

describe("its coaching lines", () => {
  it("are chapters 1-7, with the design doc's titles", () => {
    expect(lesson.chapters.map((c) => c.title)).toEqual([
      "Opening cards and events",
      "Influence and control",
      "Rival cards",
      "Intervene and the Contingency deck",
      "Escalation and realigning",
      "The tech race",
      "Scoring, winning and the abilities",
    ]);
  });

  it("are every quoted line of chapters 1-7 and the asides, in order, word for word with the doc's example numbers", () => {
    const lines = quotes(section("**1. Opening cards and events**", "## Not decided yet"));
    expect(lines).toHaveLength(25);
    const asides = (lesson.asides ?? []).map((a) => a.say);
    expect([...steps.flatMap((s) => said(s.say)), ...asides].map((l) => fill(l))).toEqual(lines);
  });

  it("chapter 1, when LIO holds no influence, drops its own-influence part as approved", () => {
    const base = fill(step("opening", 1).say);
    const own =
      "You can place where you already have influence (Taiwan), next to it, or next to the United States " +
      "(Mexico, Cuba, Canada).";
    const expected = base.replace(own, approved("You can place next to the United States (Mexico, Cuba, Canada)."));
    expect(expected).not.toBe(base);
    expect(variantSays("opening", 1).map((s) => fill(s))).toEqual([expected]);
  });

  it("chapter 1 shows SAE's event line together with Maastricht's, so it stays until LIO's next play (owner)", () => {
    approved("SAE's event line stays until LIO's next play");
    expect(lesson.chapters[0]!.steps).toHaveLength(2);
    const says = [step("opening", 1).say, ...variantSays("opening", 1)];
    for (const say of says) expect(fill(say).split("\n\n")[0]).toMatch(/^SAE picked Handover of Hong Kong\./);
    expect(step("opening", 1)).toMatchObject({ until: { decision: "playCardAs", side: "lio", turn: 1 } });
  });

  it('chapter 7 ends a free game, which is over by then, with "That\'s the coaching." (owner)', () => {
    const own = fill(step("scoring", 0).say).split("\n\n");
    expect(own[3]).toBe("That's the coaching. From here it's a normal game.");
    const variants = step("scoring", 0).variants ?? [];
    expect(variants.map((v) => v.if)).toEqual([[{ kind: "gameOver" }]]);
    const free = fill(variants[0]!.say).split("\n\n");
    expect(free).toEqual([...own.slice(0, 3), approved("That's the coaching.")]);
  });

  it("chapter 3, with Rwandan Genocide, with before and after equal, and with both, reads as approved", () => {
    const base = fill(step("rival-cards", 1).say);
    const plain = "Before: 1, plus 1 from Maastricht, minus 1, gives 1 point.";
    const rwanda = approved(
      "Before: 1, plus 1 from Maastricht, minus 1, minus 1 from Rwandan Genocide, and never below 1, gives 1 point.",
    );
    const after = approved("After: you spend 2,");
    const equal = approved("After: you also spend 1, so here the order doesn't change your points,");
    const withRwanda = base.replace(plain, rwanda);
    const withEqual = base.replace(after, equal);
    const withBoth = withRwanda.replace(after, equal);
    expect(new Set([base, withRwanda, withEqual, withBoth]).size).toBe(4);
    // Before and after are equal when the event first leaves the same points as the card's own: 1 then 1.
    const equalValues = { ...EXAMPLE, "pointsAfter:e1-sae-008": "1" };
    const [both, onlyRwanda, onlyEqual] = variantSays("rival-cards", 1);
    expect(fill(both!, equalValues)).toBe(withBoth);
    expect(fill(onlyRwanda!)).toBe(withRwanda);
    expect(fill(onlyEqual!, equalValues)).toBe(withEqual);
  });

  it("chapter 4, below 4 points, says how far below the draw the result falls, as approved", () => {
    const base = fill(step("intervene", 2).say);
    const four = approved("With 4 points, a stability-2 country such as Crimea gives a result equal to your draw.");
    const three = approved("With 3 points, a stability-2 country such as Crimea gives a result 1 below your draw.");
    const values = { ...EXAMPLE, "cardPoints:e1-lio-006": "3", "belowDraw:e1-lio-006": "1" };
    expect(fill(variantSays("intervene", 2)[0]!, values)).toBe(base.replace(four, three));
    // At 1 point: "3 below your draw", and "1 point", as the owner approved (#701).
    const one = { ...EXAMPLE, "cardPoints:e1-lio-006": "1", "belowDraw:e1-lio-006": "3" };
    expect(approved('At 1 point it reads "3 below your draw"')).toBeTruthy();
    expect(fill(variantSays("intervene", 2)[0]!, one)).toBe(
      base.replace(four, "With 1 point, a stability-2 country such as Crimea gives a result 3 below your draw."),
    );
  });

  it("chapter 4, at 5 points, says how far above the draw the result falls, as approved (#701)", () => {
    const base = fill(step("intervene", 2).say);
    const four = "With 4 points, a stability-2 country such as Crimea gives a result equal to your draw.";
    const five = approved("With 5 points, a stability-2 country such as Crimea gives a result 1 above your draw.");
    const values = { ...EXAMPLE, "cardPoints:e1-lio-006": "5", "aboveDraw:e1-lio-006": "1" };
    expect(variantSays("intervene", 2)).toHaveLength(2);
    expect(fill(variantSays("intervene", 2)[1]!, values)).toBe(base.replace(four, five));
  });

  it("fill every number of points and every place the doc says comes from the live game from a slot", () => {
    const slotted = (chapter: string, index: number, slots: string[]) => {
      const says = [step(chapter, index).say, ...variantSays(chapter, index)].join(" ");
      for (const slot of slots) expect(says).toContain(`{${slot}}`);
    };
    slotted("opening", 1, ["eventPoints:e1-lio-001", "influenceIn:lio", "homeNeighbours:lio"]);
    slotted("influence", 0, ["cardPoints:e1-lio-004"]);
    slotted("rival-cards", 1, ["pointsBefore:e1-sae-008", "pointsAfter:e1-sae-008", "modifierTakesOff:e1-neu-001"]);
    slotted("intervene", 1, ["cardPoints:e1-lio-006"]);
    slotted("intervene", 2, ["cardPoints:e1-lio-006", "belowDraw:e1-lio-006"]);
    slotted("escalation-realign", 0, ["cardPoints:e1-lio-002"]);
    slotted("tech-race", 1, ["cardPoints:e1-sae-004", "eventPoints:e1-sae-004", "techRaceCost:lio"]);
    slotted("tech-race", 2, ["cardPoints:e1-sae-004"]);
  });
});

describe("chapter 6's variants (#701)", () => {
  const all3 = "All 3 points go to this one try, so any above the cost are lost.";
  it("when Second Chechen War can't pay the step, read as approved, with the doc's example of 1 point and a cost of 2", () => {
    const values = { ...EXAMPLE, "cardPoints:e1-sae-004": "1", "techRaceCost:lio": "2" };
    const base = fill(step("tech-race", 1).say, values);
    const play = "Play Second Chechen War, SAE's card, on the tech race.";
    const cantPay = approved(
      "Your 1 point can't pay this step's cost of 2 this turn. Play Second Chechen War for its points and place " +
        "influence instead: its event, SAE's, still happens.",
    );
    const anyOther =
      "Played any other way, its event would give SAE 2 points and raise Escalation. Points spent on the tech race " +
      "cancel a rival card's event.";
    const thisWay = approved(
      "Played this way, its event gives SAE 2 points and raises Escalation. Points spent on the tech race would " +
        "have cancelled it.",
    );
    const expected = base.replace(play, cantPay).replace(anyOther, thisWay);
    expect(expected).toBe(`${cantPay} ${thisWay}`);
    expect(variantSays("tech-race", 1).map((s) => fill(s, values))).toEqual([expected]);

    const track = fill(step("tech-race", 2).say);
    expect(approved(all3)).toBeTruthy();
    expect(track).toContain(all3);
    expect(fill(variantSays("tech-race", 2)[0]!, values)).toBe(track.replace(`${all3} `, ""));
  });

  it("at 1 point, say the point goes to the one try, without 'so any above the cost are lost', as approved", () => {
    const values = { ...EXAMPLE, "cardPoints:e1-sae-004": "1" };
    const track = fill(step("tech-race", 2).say);
    const one = approved("Your 1 point goes to this one try.");
    expect(fill(variantSays("tech-race", 2)[1]!, values)).toBe(track.replace(all3, one));
  });

  it("let the tech race's last step coach placing when the points can't pay, its words unchanged", () => {
    const [cantPay] = step("tech-race", 3).variants!;
    expect(cantPay!.say).toBe(step("tech-race", 3).say);
    expect(cantPay!.allow).toEqual([{ kind: "chooseAction", action: "place" }]);
  });
});
