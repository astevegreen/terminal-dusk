// R18b (#345): the sixteen cards that move Escalation by 1 (map-and-points.md, "Cards that move it"), on top of
// what each already does. Owner's answer to the placement question: P2 with B1. The move is the effect's last
// step (P2), outside every choice and draw (B1); the only exceptions are the two arms-control cards, whose move is
// the last step of the branch already decided: Test Ban Treaty when both ratify, ABM Treaty Withdrawal when LIO
// leaves the treaty.
import type { Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { FIRST_DECK_CARDS } from "./firstDeckRules.ts";

const RAISE = [
  "e1-lio-006", // Desert Storm Coalition
  "e1-sae-004", // Second Chechen War
  "e1-sae-007", // Taiwan Strait Crisis
  "e2-lio-004", // ABM Treaty Withdrawal (only if LIO leaves the treaty)
  "e2-sae-001", // Invasion of Iraq
  "e2-sae-007", // North Korean Nuclear Test
  "e2-sae-013", // Chinese Anti-Satellite Test
  "e3-sae-003", // Annexation of Crimea
  "e3-sae-004", // Full-Scale Invasion
  "e3-sae-012", // Hypersonics on Parade
];
const LOWER = [
  "e1-lio-002", // Budapest Memorandum
  "e1-lio-012", // Partnership for Peace
  "e1-lio-013", // Oslo Accords
  "e1-neu-004", // Test Ban Treaty (only if both sides ratify)
  "e2-lio-006", // Libya Disarms
  "e2-lio-013", // India-US Nuclear Deal
];
const ARMS_CONTROL = ["e1-neu-004", "e2-lio-004"];

/** Every escalate step in a block, at any depth: in if branches, forEach bodies and trigger reactions too. */
function escalates(steps: readonly Step[]): Step[] {
  return steps.flatMap((step): Step[] => {
    switch (step.op) {
      case "escalate":
        return [step];
      case "if":
        return [...escalates(step.then), ...escalates(step.else ?? [])];
      case "trigger":
        return escalates(step.do);
      default:
        return "do" in step && Array.isArray(step.do) ? escalates(step.do as Step[]) : [];
    }
  });
}

const card = (id: string) => FIRST_DECK_CARDS.find((c) => c.id === id)!;
const effect = (id: string) => card(id).effect as readonly Step[];

describe("the sixteen cards that move Escalation", () => {
  it("are found in the deck: ten raise and six lower", () => {
    for (const id of [...RAISE, ...LOWER]) expect(card(id)).toBeDefined();
    expect(RAISE).toHaveLength(10);
    expect(LOWER).toHaveLength(6);
  });

  it("each has exactly one escalate step: by 1 for a raise, by -1 for a lower", () => {
    for (const id of RAISE) expect(escalates(effect(id))).toEqual([{ op: "escalate", by: 1 }]);
    for (const id of LOWER) expect(escalates(effect(id))).toEqual([{ op: "escalate", by: -1 }]);
  });

  it("no other card moves Escalation", () => {
    const moving = FIRST_DECK_CARDS.filter((c) => escalates(c.effect as readonly Step[]).length > 0).map((c) => c.id);
    expect([...moving].sort()).toEqual([...RAISE, ...LOWER].sort());
  });

  it("P2 with B1: the move is the effect's last step, outside every choice and draw", () => {
    for (const id of [...RAISE, ...LOWER].filter((i) => !ARMS_CONTROL.includes(i))) {
      expect(effect(id).at(-1)).toEqual(escalates(effect(id))[0]);
    }
  });

  it("Test Ban Treaty lowers it as the last step of its both-ratify branch only", () => {
    const [, lioRatifies] = effect("e1-neu-004");
    if (lioRatifies?.op !== "if") throw new Error("Test Ban Treaty's second step should be an if.");
    const [saeRatifies] = lioRatifies.then;
    if (saeRatifies?.op !== "if") throw new Error("Test Ban Treaty's yes branch should start with an if.");
    expect(saeRatifies.then.at(-1)).toEqual({ op: "escalate", by: -1 });
  });

  it("ABM Treaty Withdrawal raises it as the last step of its leave-the-treaty branch only", () => {
    const [, leaves] = effect("e2-lio-004");
    if (leaves?.op !== "if") throw new Error("ABM Treaty Withdrawal's second step should be an if.");
    expect(leaves.then.at(-1)).toEqual({ op: "escalate", by: 1 });
  });

  it("each says its move in its rules text, once: Raise or Lower Escalation by 1", () => {
    for (const id of RAISE) {
      expect(card(id).text.rules.match(/raise Escalation by 1/gi)).toHaveLength(1);
      expect(card(id).text.rules).not.toMatch(/lower Escalation/i);
    }
    for (const id of LOWER) {
      expect(card(id).text.rules.match(/lower Escalation by 1/gi)).toHaveLength(1);
      expect(card(id).text.rules).not.toMatch(/raise Escalation/i);
    }
  });

  it("the cards outside a branch say it as its own sentence, after the effect's other sentences", () => {
    for (const id of [...RAISE, ...LOWER].filter((i) => !ARMS_CONTROL.includes(i))) {
      const sentence = RAISE.includes(id) ? "Raise Escalation by 1." : "Lower Escalation by 1.";
      const rules = card(id).text.rules.replace(
        " If this card's event happens, remove it from the game afterwards.",
        "",
      );
      expect(rules.endsWith(` ${sentence}`)).toBe(true);
    }
  });
});
