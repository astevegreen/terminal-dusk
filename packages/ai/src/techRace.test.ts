// The AI and the tech race (A17, issue #471): Easy takes an attempt as one more legal answer; Medium weighs it by
// the odds of its own Contingency deck, the first-there +1 and a crisis from entering Hypersonics.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { legalAnswers, viewFor } from "@terminal-dusk/engine";
import type { AnswerValue, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { boardValue, techValue } from "./evaluate.ts";
import { guessHidden } from "./guess.ts";
import { attemptValue, mediumAnswer } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { drawVariants } from "./techRace.ts";
import { newSixRegionMapGame } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

const isAttempt = (value: AnswerValue | null): boolean => value?.kind === "chooseAction" && value.action === "techRace";

/** The menu's side, when `state` waits on an action menu that offers a tech race attempt. */
function techMenuSide(state: TestState): Side | null {
  const menu = state.public.pending.find((d) => d.kind === "chooseAction");
  if (menu === undefined || !legalAnswers(FIRST_DECK_RULESET, state, menu.side).some(isAttempt)) return null;
  return menu.side;
}

/** Every state in Easy's six-region games `seeds` that waits on an action menu offering a tech race attempt. */
function techMenus(seeds: number[]): TestState[] {
  const menus: TestState[] = [];
  for (const seed of seeds) {
    playEasy(FIRST_DECK_RULESET, newSixRegionMapGame(seed), EASY_WEIGHTS, seededRandom(seed), {
      applied: (before) => {
        if (techMenuSide(before) !== null) menus.push(before);
      },
    });
  }
  return menus;
}

const MENUS = techMenus([1, 2, 3, 4]);

/** `state` with `side`'s own Contingency deck holding just `numbers`, in that order, and its bonus `bonus`. */
function withDeck(state: TestState, side: Side, numbers: number[], bonus = false): TestState {
  const race = state.public.techRace!;
  const others = race.bonus.filter((s) => s !== side);
  return {
    ...state,
    public: {
      ...state.public,
      contingency: { ...state.public.contingency, [side]: { cards: [...numbers], left: [...numbers] } },
      techRace: { ...race, bonus: bonus ? [...others, side].sort() : others },
    },
    secret: { ...state.secret, contingency: { ...state.secret.contingency, [side]: [...numbers] } },
  };
}

/** Medium's value of an attempt by `side` in `state`, from its view and one guess of what it cannot see. */
function valueOf(state: TestState, side: Side): number {
  const view = viewFor(state, side);
  const hidden = guessHidden(FIRST_DECK_RULESET, view, side, seededRandom(1));
  return attemptValue(FIRST_DECK_RULESET, view, hidden, side, MEDIUM_WEIGHTS);
}

const medium = (state: TestState, side: Side, seed: number) =>
  mediumAnswer(FIRST_DECK_RULESET, viewFor(state, side), side, MEDIUM_WEIGHTS, seededRandom(seed));

describe("the AI and the tech race", () => {
  it("is offered tech race attempts in six-region games", () => {
    expect(MENUS.length).toBeGreaterThan(0);
  });

  it("Easy makes tech race attempts as one more legal answer, and its games end", () => {
    let attempts = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const final = playEasy(FIRST_DECK_RULESET, newSixRegionMapGame(seed), EASY_WEIGHTS, seededRandom(seed), {
        applied: (_before, _after, _events, answer) => {
          if ("value" in answer && isAttempt(answer.value)) attempts++;
        },
      });
      expect(final.public.status.kind).toBe("over");
    }
    expect(attempts).toBeGreaterThan(0);
  });

  it("Medium never makes an attempt its own deck cannot win", () => {
    for (const menu of MENUS) {
      const side = techMenuSide(menu)!;
      const hopeless = withDeck(menu, side, [1, 2, 3]);
      for (let seed = 1; seed <= 3; seed++) expect(isAttempt(medium(hopeless, side, seed))).toBe(false);
    }
  });

  it("Medium values an attempt more the better its odds", () => {
    const menu = MENUS[0]!;
    const side = techMenuSide(menu)!;
    const value = (numbers: number[]) => valueOf(withDeck(menu, side, numbers), side);
    expect(value([1, 1, 9])).toBeLessThan(value([1, 9, 9]));
    expect(value([1, 9, 9])).toBeLessThan(value([9, 9, 9]));
  });

  it("Medium counts the first-there +1: a deck of 3s wins only with it", () => {
    const menu = MENUS[0]!;
    const side = techMenuSide(menu)!;
    const value = (bonus: boolean) => valueOf(withDeck(menu, side, [3, 3, 3], bonus), side);
    expect(value(true)).toBeGreaterThan(value(false));
  });

  it("weighs each number left in the side's own deck by its share, with that number drawn first", () => {
    const menu = MENUS[0]!;
    const side = techMenuSide(menu)!;
    const view = viewFor(withDeck(menu, side, [2, 5, 5, 7]), side);
    const hidden = guessHidden(FIRST_DECK_RULESET, view, side, seededRandom(1));
    const variants = drawVariants(view, hidden, side);
    expect(variants.map((v) => [v.hidden.secret.contingency[side][0], v.weight])).toEqual([
      [2, 1 / 4],
      [5, 2 / 4],
      [7, 1 / 4],
    ]);
    for (const v of variants) expect([...v.hidden.secret.contingency[side]].sort()).toEqual([2, 5, 5, 7]);
  });

  // Medium takes a sure attempt in only about 1 menu in 15, so this test samples eight games, not four: with Taiwan at
  // LIO 2 (X15, #472) seeds 1-4 hold none, seeds 5-8 one.
  it("Medium makes sure attempts in some menus but not all: it weighs them against placing influence", () => {
    let attempts = 0;
    const menus = techMenus([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const menu of menus) {
      const side = techMenuSide(menu)!;
      if (isAttempt(medium(withDeck(menu, side, [9, 9, 9]), side, 1))) attempts++;
    }
    expect(attempts).toBeGreaterThan(0);
    expect(attempts).toBeLessThan(menus.length);
  });

  it("Medium does not enter Hypersonics on its own attempt when that makes a crisis", () => {
    let checked = 0;
    for (const menu of MENUS) {
      const side = techMenuSide(menu)!;
      const decision = menu.public.pending.find((d) => d.kind === "chooseAction")!;
      if (!("points" in decision.options) || decision.options.points < 3) continue;
      const sure = withDeck(menu, side, [9, 9, 9]);
      const marker = side === "lio" ? -2 : 2;
      const state = {
        ...sure,
        public: { ...sure.public, escalation: 5, techRace: { ...sure.public.techRace!, marker } },
      };
      checked++;
      expect(isAttempt(medium(state, side, 1))).toBe(false);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("values the marker leaning its way and its own first-there +1, the rival's against it", () => {
    const pub = MENUS[0]!.public;
    const at = (marker: number, bonus: Side[]) => ({ ...pub, techRace: { ...pub.techRace!, marker, bonus } });
    expect(techValue(at(-1, []), "lio", MEDIUM_WEIGHTS)).toBeGreaterThan(techValue(at(0, []), "lio", MEDIUM_WEIGHTS));
    expect(techValue(at(1, []), "lio", MEDIUM_WEIGHTS)).toBeLessThan(techValue(at(0, []), "lio", MEDIUM_WEIGHTS));
    expect(techValue(at(0, ["lio"]), "lio", MEDIUM_WEIGHTS)).toBeGreaterThan(0);
    expect(techValue(at(0, ["sae"]), "lio", MEDIUM_WEIGHTS)).toBeLessThan(0);
    expect(boardValue(at(-2, []), "lio", MEDIUM_WEIGHTS)).toBeGreaterThan(boardValue(at(0, []), "lio", MEDIUM_WEIGHTS));
  });

  it("counts holding Quantum Computing as one era-end region point more", () => {
    const pub = MENUS[0]!.public;
    const at = (marker: number) => ({ ...pub, techRace: { ...pub.techRace!, marker, bonus: [] } });
    const step = techValue(at(-3), "lio", MEDIUM_WEIGHTS) - techValue(at(-2), "lio", MEDIUM_WEIGHTS);
    const end = techValue(at(-4), "lio", MEDIUM_WEIGHTS) - techValue(at(-3), "lio", MEDIUM_WEIGHTS);
    expect(end - step).toBeCloseTo(MEDIUM_WEIGHTS.region);
    expect(techValue(at(4), "lio", MEDIUM_WEIGHTS)).toBeCloseTo(-techValue(at(-4), "lio", MEDIUM_WEIGHTS));
  });
});
