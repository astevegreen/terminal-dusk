import { legalAnswers } from "@terminal-dusk/engine";
import type { AnswerValue } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { chooseDefault, defaultAnswer } from "./defaultAnswer.ts";
import type { Costs } from "./defaultAnswer.ts";
import { ruleset } from "./test/match.ts";
import { started } from "./test/play.ts";

const OPS: Record<string, number> = { a: 3, b: 1, c: 2, d: 1 };
const COST: Record<string, number> = { x: 2, y: 1, z: 1 };
const costs: Costs = { opsOf: (card) => OPS[card] ?? 0, costOf: (country) => COST[country] ?? 0 };

describe('chooseDefault: one answer per Decision kind (owner, 21 Nov 2026: "Take all")', () => {
  it("extraPlay: pass", () => {
    const legal: AnswerValue[] = [{ kind: "playCardAs", card: "b", as: "points" }, { kind: "pass" }];
    expect(chooseDefault("extraPlay", legal, costs)).toEqual({ kind: "pass" });
  });

  it("realign: stop, leaving the attempts unmade", () => {
    const legal: AnswerValue[] = [
      { kind: "realign", country: "x" },
      { kind: "realign", country: null },
    ];
    expect(chooseDefault("realign", legal, costs)).toEqual({ kind: "realign", country: null });
  });

  it("yesNo: no", () => {
    const legal: AnswerValue[] = [
      { kind: "yesNo", yes: true },
      { kind: "yesNo", yes: false },
    ];
    expect(chooseDefault("yesNo", legal, costs)).toEqual({ kind: "yesNo", yes: false });
  });

  it("rivalEventOrder: before", () => {
    const legal: AnswerValue[] = [
      { kind: "rivalEventOrder", event: "after" },
      { kind: "rivalEventOrder", event: "before" },
    ];
    expect(chooseDefault("rivalEventOrder", legal, costs)).toEqual({ kind: "rivalEventOrder", event: "before" });
  });

  describe("chooseAction", () => {
    const realign: AnswerValue = { kind: "chooseAction", action: "realign" };
    const place: AnswerValue = { kind: "chooseAction", action: "place" };
    const pass: AnswerValue = { kind: "chooseAction", action: "pass" };
    const intervene: AnswerValue = { kind: "chooseAction", action: "intervene", country: "y" };
    const tech: AnswerValue = { kind: "chooseAction", action: "techRace" };
    it("pass when the menu offers it", () => {
      expect(chooseDefault("chooseAction", [realign, tech, pass], costs)).toEqual(pass);
    });
    it("no pass: realign (then stop), before placing or intervening", () => {
      expect(chooseDefault("chooseAction", [place, intervene, realign, tech], costs)).toEqual(realign);
    });
    it("no pass and no realign: place", () => {
      expect(chooseDefault("chooseAction", [place, intervene, tech], costs)).toEqual(place);
    });
    it("only interventions: the first target, in map order", () => {
      const other: AnswerValue = { kind: "chooseAction", action: "intervene", country: "z" };
      expect(chooseDefault("chooseAction", [intervene, other, tech], costs)).toEqual(intervene);
    });
  });

  it("placeInfluence: the cheapest country, the first in map order on a tie", () => {
    const legal: AnswerValue[] = ["x", "y", "z"].map((country) => ({ kind: "placeInfluence", country }));
    expect(chooseDefault("placeInfluence", legal, costs)).toEqual({ kind: "placeInfluence", country: "y" });
  });

  it("chooseCard: the card with the fewest points, the first in hand order on a tie", () => {
    const legal: AnswerValue[] = ["a", "c", "b", "d"].map((card) => ({ kind: "chooseCard", card }));
    expect(chooseDefault("chooseCard", legal, costs)).toEqual({ kind: "chooseCard", card: "b" });
  });

  it("playCardAs: the card with the fewest points, played for its points", () => {
    const legal: AnswerValue[] = [
      { kind: "playCardAs", card: "a", as: "event" },
      { kind: "playCardAs", card: "a", as: "points" },
      { kind: "playCardAs", card: "d", as: "event" },
      { kind: "playCardAs", card: "d", as: "points" },
      { kind: "playCardAs", card: "b", as: "points" },
    ];
    expect(chooseDefault("playCardAs", legal, costs)).toEqual({ kind: "playCardAs", card: "d", as: "points" });
  });

  it("discardCards: the cards with the fewest points (from either hand: the list is the engine's)", () => {
    const legal: AnswerValue[] = [
      ["a", "c"],
      ["a", "b"],
      ["c", "b"],
      ["c", "d"],
      ["b", "d"],
    ].map((cards) => ({
      kind: "discardCards",
      cards,
    }));
    expect(chooseDefault("discardCards", legal, costs)).toEqual({ kind: "discardCards", cards: ["b", "d"] });
  });

  it("null only when there is no legal answer", () => {
    expect(chooseDefault("yesNo", [], costs)).toBeNull();
    expect(chooseDefault("playCardAs", [], costs)).toBeNull();
  });
});

describe("defaultAnswer on a real game", () => {
  it("is always one of the engine's legal answers, and null for a side with nothing waiting", () => {
    const host = started();
    const state = host.secret.state;
    for (const side of ["lio", "sae"] as const) {
      const answer = defaultAnswer(ruleset, state, side);
      expect(legalAnswers(ruleset, state, side)).toContainEqual(answer);
    }
  });
});
