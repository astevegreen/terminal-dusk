// Tutorial lines with live slots, variants and asides (#698; docs/design/tutorial.md, "Coaching words").
import { describe, expect, it } from "vitest";
import * as content from "../src/index.ts";
import { lessonSchema } from "./tutorial.ts";
import { CONDITIONS, SAY_MAX, SLOTS, splitLine } from "./tutorialLines.ts";

const base = {
  id: "lesson-1",
  title: "Your first game",
  placeholder: true,
  deckTop: ["e1-lio-001", "e1-sae-001"],
  chapters: [
    { id: "ch1", title: "Opening", steps: [{ when: { start: true }, say: "Welcome." }] },
    { id: "ch7", title: "Abilities", steps: [{ when: { start: true }, say: "Abilities." }] },
  ],
};
type Step = Record<string, unknown>;
const withStep = (step: Step) => ({ ...base, chapters: [{ ...base.chapters[0], steps: [step] }, base.chapters[1]] });
const passes = (data: unknown) => lessonSchema.safeParse(data).success;
const says = (say: string) => passes(withStep({ when: { start: true }, say }));

const chapter1 =
  "You can place where you already have influence ({influenceIn:lio}), next to it, or next to the United States " +
  "({homeNeighbours:lio}).";
const noInfluence = "You can place next to the United States ({homeNeighbours:lio}).";
const chapter6 = "Play Second Chechen War, SAE's card, on the tech race. It costs {techRaceCost:lio}.";
const cantPay =
  "Your {cardPoints:e1-sae-001} point can't pay this step's cost of {techRaceCost:lio} this turn. Play it for its " +
  "points and place influence instead.";

describe("a coaching line's slots", () => {
  it("passes a line with slots and a variant", () => {
    const variant = { if: [{ kind: "noInfluence", side: "lio" }], say: noInfluence };
    expect(passes(withStep({ when: { start: true }, say: chapter1, variants: [variant] }))).toBe(true);
  });

  it("covers every live number and place the design names", () => {
    expect(Object.keys(SLOTS).sort()).toEqual(
      [
        "cardPoints",
        "eventPoints",
        "homeNeighbours",
        "influenceIn",
        "modifierTakesOff",
        "pointsAfter",
        "pointsBefore",
        "techRaceCost",
        "belowDraw",
        "aboveDraw",
      ].sort(),
    );
    const card = "e1-sae-001";
    for (const [slot, arg] of Object.entries(SLOTS)) {
      expect(says(`It is {${slot}:${arg === "card" ? card : "lio"}}.`), slot).toBe(true);
    }
  });

  it("fails an unknown slot, as content:check does", () => {
    expect(says("You have {score:lio} points.")).toBe(false);
    expect(content.lessonSchema.safeParse(withStep({ when: { start: true }, say: "{nope}" })).success).toBe(false);
  });

  it("fails a slot whose card or side is wrong or missing", () => {
    expect(says("{cardPoints}")).toBe(false);
    expect(says("{cardPoints:e2-lio-001}")).toBe(false);
    expect(says("{cardPoints:lio}")).toBe(false);
    expect(says("{influenceIn:usa}")).toBe(false);
    expect(says("{influenceIn}")).toBe(false);
    expect(says("{techRaceCost:e1-lio-001}")).toBe(false);
  });

  it("belowDraw names an Era 1 card, never a side or a later card (chapter 4, #700)", () => {
    expect(says("a result {belowDraw:e1-lio-006} below your draw")).toBe(true);
    expect(says("{belowDraw:lio}")).toBe(false);
    expect(says("{belowDraw:e2-lio-001}")).toBe(false);
    expect(says("{belowDraw}")).toBe(false);
  });

  it("fails a brace that opens or closes no slot", () => {
    for (const line of ["a { b", "a } b", "{}", "{:lio}", "{a{b}}"]) expect(says(line), line).toBe(false);
  });

  it("cuts a line into its text and slots for the host to fill", () => {
    expect(splitLine("Mexico ({homeNeighbours:lio}) costs {techRaceCost:lio}.")).toEqual({
      pieces: [
        { text: "Mexico (" },
        { slot: "homeNeighbours", arg: "lio" },
        { text: ") costs " },
        { slot: "techRaceCost", arg: "lio" },
        { text: "." },
      ],
    });
    expect(content.splitLine("No slots.")).toEqual({ pieces: [{ text: "No slots." }] });
  });
});

describe("a step's variants", () => {
  const step = { when: { decision: "playCardAs", side: "lio" }, say: chapter6 };
  const below = { kind: "pointsBelowTechRaceCost", card: "e1-sae-001", side: "lio" };

  it("passes a coach variant with its own allow", () => {
    const allow = [{ kind: "playCardAs", card: "e1-sae-001", as: "points" }, { kind: "placeInfluence" }];
    expect(passes(withStep({ ...step, variants: [{ if: [below], say: cantPay, allow }] }))).toBe(true);
  });

  it("covers every condition the design names, alone or together", () => {
    expect([...CONDITIONS].sort()).toEqual(
      [
        "modifierInForce",
        "noInfluence",
        "pointsBeforeEqualsAfter",
        "pointsBelowTechRaceCost",
        "resultBelowDraw",
        "resultAboveDraw",
        "onePoint",
      ].sort(),
    );
    const both = [
      { kind: "modifierInForce", card: "e1-sae-001" },
      { kind: "pointsBeforeEqualsAfter", card: "e1-sae-001" },
    ];
    expect(
      passes(
        withStep({
          ...step,
          variants: [
            { if: both, say: "Both." },
            { if: [below], say: "Below." },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("fails an unknown condition, or a condition missing its card or side", () => {
    expect(passes(withStep({ ...step, variants: [{ if: [{ kind: "rainy" }], say: "x" }] }))).toBe(false);
    expect(passes(withStep({ ...step, variants: [{ if: [{ kind: "noInfluence" }], say: "x" }] }))).toBe(false);
    const noSide = { kind: "pointsBelowTechRaceCost", card: "e1-sae-001" };
    expect(passes(withStep({ ...step, variants: [{ if: [noSide], say: "x" }] }))).toBe(false);
    expect(passes(withStep({ ...step, variants: [{ if: [], say: "x" }] }))).toBe(false);
  });

  it("resultBelowDraw names one Era 1 card and nothing else (chapter 4, #700)", () => {
    const variant = (c: Record<string, unknown>) => withStep({ ...step, variants: [{ if: [c], say: "x" }] });
    expect(passes(variant({ kind: "resultBelowDraw", card: "e1-lio-006" }))).toBe(true);
    expect(passes(variant({ kind: "resultBelowDraw" }))).toBe(false);
    expect(passes(variant({ kind: "resultBelowDraw", card: "e2-lio-001" }))).toBe(false);
    expect(passes(variant({ kind: "resultBelowDraw", card: "e1-lio-006", side: "lio" }))).toBe(false);
  });

  it("fails a variant with no text, too much text, or an unknown slot", () => {
    expect(passes(withStep({ ...step, variants: [{ if: [below] }] }))).toBe(false);
    expect(passes(withStep({ ...step, variants: [{ if: [below], say: "" }] }))).toBe(false);
    expect(passes(withStep({ ...step, variants: [{ if: [below], say: "a".repeat(SAY_MAX + 1) }] }))).toBe(false);
    expect(passes(withStep({ ...step, variants: [{ if: [below], say: "a".repeat(SAY_MAX) }] }))).toBe(true);
    expect(passes(withStep({ ...step, variants: [{ if: [below], say: "{nope}" }] }))).toBe(false);
  });

  it("fails a hint variant with allow", () => {
    const variant = { if: [below], say: "x", allow: [{ kind: "placeInfluence" }] };
    const r = lessonSchema.safeParse(withStep({ ...step, style: "hint", variants: [variant] }));
    expect(r.success ? [] : r.error.issues.map((i) => i.path.slice(-3))).toEqual([["variants", 0, "allow"]]);
    expect(passes(withStep({ ...step, style: "hint", variants: [{ if: [below], say: "x" }] }))).toBe(true);
  });
});

describe("a lesson's asides", () => {
  const redraw = {
    when: { event: "abilityRedraw", side: "lio" },
    before: "ch7",
    say: "Resilient institutions set your 1 aside, and you drew again. Chapter 7 explains.",
  };
  const bonus = { when: { event: "abilityBonus" }, before: "ch7", say: "Unified command. Chapter 7 explains." };

  it("passes a valid aside", () => {
    expect(passes({ ...base, asides: [redraw, bonus] })).toBe(true);
  });

  it("fails an aside naming an unknown chapter", () => {
    const r = lessonSchema.safeParse({ ...base, asides: [{ ...redraw, before: "ch9" }] });
    expect(r.success ? [] : r.error.issues.map((i) => i.path)).toEqual([["asides", 0, "before"]]);
  });

  it("fails an aside with no text, an unknown slot, allow, or a trigger that is not an event", () => {
    expect(passes({ ...base, asides: [{ ...redraw, say: "" }] })).toBe(false);
    expect(passes({ ...base, asides: [{ ...redraw, say: "{nope}" }] })).toBe(false);
    expect(passes({ ...base, asides: [{ ...redraw, allow: [{ kind: "pass" }] }] })).toBe(false);
    expect(passes({ ...base, asides: [{ ...redraw, when: { decision: "chooseCard" } }] })).toBe(false);
    expect(passes({ ...base, asides: [{ ...redraw, when: { event: "somethingHappened" } }] })).toBe(false);
  });

  it("fails a lesson with two chapters of the same id, so before names one chapter", () => {
    const r = lessonSchema.safeParse({ ...base, chapters: [base.chapters[0], { ...base.chapters[1], id: "ch1" }] });
    expect(r.success ? [] : r.error.issues.map((i) => i.path)).toEqual([["chapters", 1, "id"]]);
  });
});
