// A filled number of points always reads "1 point" or "N points", and chapter 4's line at 5 points says how far
// above the draw the result falls (#701; docs/design/tutorial.md, owner, 27 Nov 2026). Real first-deck game frames.
import { describe, expect, it } from "vitest";
import { firstDeckRuleset } from "../firstDeck.ts";
import { deepFreeze } from "../test/deepFreeze.ts";
import { inForce, learnerFrames, learnerFrameWhere } from "../test/tutorialGame.ts";
import type { Frame } from "../types.ts";
import { fillLine, fillText } from "./fill.ts";

const fill = (words: string, frame: Frame) => fillText(words, frame, firstDeckRuleset);
const start = deepFreeze(learnerFrames().next().value!);
/** Maastricht's +1 for LIO in force: Desert Storm Coalition (4) has 5 points. */
const maastricht = deepFreeze(learnerFrameWhere((f) => inForce(f, "e1-lio-001") && f.decision?.kind === "playCardAs"));
/** Rwandan Genocide's -2 for LIO in force: Budapest Memorandum (e1-lio-002, 2) has 1 point, never below 1. */
const rwanda = deepFreeze(learnerFrameWhere((f) => inForce(f, "e1-neu-001")));

describe("a filled number of points reads 1 point or N points", () => {
  it("writes 'point' after a filled 1 and 'points' after any other number, whichever the line has", () => {
    expect(fill("for its {cardPoints:e1-lio-002} points and", rwanda)).toBe("for its 1 point and");
    expect(fill("gives you {cardPoints:e1-lio-002} point now", start)).toBe("gives you 2 points now");
    expect(fill("{cardPoints:e1-lio-002} points, {cardPoints:e1-lio-004} point.", start)).toBe("2 points, 3 points.");
  });

  it("leaves other words after a number alone", () => {
    expect(fill("{cardPoints:e1-lio-002} pointer", rwanda)).toBe("1 pointer");
    expect(fill("It costs {techRaceCost:lio}. Points", start)).toBe("It costs 1. Points");
  });
});

describe("chapter 4 above 4 points", () => {
  it("aboveDraw: how far above the draw a stability-2 intervention's result falls, the card's points minus 4", () => {
    expect(fill("a result {aboveDraw:e1-lio-006} above your draw", maastricht)).toBe("a result 1 above your draw");
    expect(() => fill("{aboveDraw:e1-lio-006}", start)).toThrow(/is 0: the result is not above the draw/);
  });

  it("resultAboveDraw: a variant for a card with more than 4 points", () => {
    const line = {
      say: "equal",
      variants: [
        { if: [{ kind: "resultAboveDraw" as const, card: "e1-lio-006" }], say: "{aboveDraw:e1-lio-006} above" },
      ],
    };
    expect(fillLine(line, maastricht, firstDeckRuleset).text).toBe("1 above");
    expect(fillLine(line, start, firstDeckRuleset).text).toBe("equal");
  });

  it("onePoint: a variant for a card that gives the learner exactly 1 point now", () => {
    const line = { say: "Many.", variants: [{ if: [{ kind: "onePoint" as const, card: "e1-lio-002" }], say: "One." }] };
    expect(fillLine(line, rwanda, firstDeckRuleset).text).toBe("One.");
    expect(fillLine(line, start, firstDeckRuleset).text).toBe("Many.");
  });
});
