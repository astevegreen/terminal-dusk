// The fuzz suite and the lasting effects, modifiers (#89) and triggers (#90): the fuzz cards make them, and
// the checks catch what they should.
import { createGame, seedHash } from "@terminal-dusk/engine";
import type { ActiveModifier, ActiveTrigger, GameState, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkModifiers, checkTriggers } from "./checks.ts";
import { ruleset } from "./play.ts";

const SEED = "modifier-seed";

/** A new one-turn game with known cards. */
function started(): GameState {
  const r = createGame(
    ruleset,
    {
      seedHash: seedHash(SEED),
      hands: { lio: ["c1", "c4"], sae: ["c2", "c5"] },
      deck: ["c6"],
      turns: 1,
      playsPerTurn: 1,
      handSize: 2,
      contingency: { lio: [1, 2, 3, 4, 5, 6], sae: [1, 2, 3, 4, 5, 6] },
    },
    SEED,
  );
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value.state;
}

const modifierIn = (turn: number): ActiveModifier => ({
  source: "c2",
  mod: { hook: "opsValue", side: "both", add: -1 },
  expires: { kind: "turnEnd", turn },
});
const withPublic = (s: GameState, change: Partial<GameState["public"]>): GameState => ({
  ...s,
  public: { ...s.public, ...change },
});

describe("the fuzz cards make modifiers", () => {
  const modifiers = ruleset.cards.flatMap((card) =>
    card.effect.filter((step): step is Extract<Step, { op: "modifier" }> => step.op === "modifier"),
  );
  it("some cards' effects end with a modifier step, spread over every add, min and side", () => {
    expect(new Set(modifiers.map((s) => s.mod.add))).toEqual(new Set([-2, -1, 1, 2]));
    expect(new Set(modifiers.map((s) => s.mod.min))).toEqual(new Set([0, 1, undefined]));
    expect(new Set(modifiers.map((s) => s.mod.side))).toEqual(new Set(["lio", "sae", "both"]));
  });
  it("is the same fixed list on every run, built from each card's index", () => {
    expect(ruleset.cards.filter((card) => card.effect.at(-1)?.op === "modifier").map((card) => card.id)).toEqual(
      Array.from({ length: 17 }, (_, k) => `c${5 * k + 2}`),
    );
  });
});

describe("checkModifiers", () => {
  it("passes a game with no modifiers, and one whose modifiers end with the current turn", () => {
    expect(() => checkModifiers(started())).not.toThrow();
    expect(() => checkModifiers(withPublic(started(), { modifiers: [modifierIn(1)] }))).not.toThrow();
  });
  it("catches an active game holding a modifier from an earlier turn", () => {
    const s = withPublic(started(), { turn: 2, modifiers: [modifierIn(1)] });
    expect(() => checkModifiers(s)).toThrow(/do not end with this turn/);
  });
  it("catches a finished game that still holds a modifier, which checkLive would skip", () => {
    const s = withPublic(started(), {
      status: { kind: "over", winner: null, reason: "turnLimitReached" },
      modifiers: [modifierIn(1)],
    });
    expect(() => checkModifiers(s)).toThrow(/the game is over/);
  });
});

describe("the fuzz cards set triggers", () => {
  const triggers = ruleset.cards.flatMap((card) =>
    card.effect.filter((step): step is Extract<Step, { op: "trigger" }> => step.op === "trigger"),
  );
  it("some cards' effects end with a trigger, for both hooks, whose reaction asks nothing", () => {
    expect(new Set(triggers.map((s) => s.hook))).toEqual(new Set(["cardPlayed", "turnEnd"]));
    // Markers only, but for a neutral card's draw from the player's deck (#117), which asks nothing either.
    const reactions = triggers.flatMap((s) => s.do);
    const isPlayerDraw = (step: Step) => step.op === "drawContingency" && step.side === "player";
    expect(reactions.every((step) => step.op === "marker" || isPlayerDraw(step))).toBe(true);
  });
  it("is the same fixed list on every run, built from each card's index", () => {
    expect(ruleset.cards.filter((card) => card.effect.at(-1)?.op === "trigger").map((card) => card.id)).toEqual(
      Array.from({ length: 9 }, (_, k) => `c${10 * k + 4}`),
    );
  });
});

describe("checkTriggers", () => {
  const triggerIn = (turn: number): ActiveTrigger => ({
    source: "c4",
    hook: "cardPlayed",
    do: [{ op: "marker", label: "m" }],
    expires: { kind: "turnEnd", turn },
  });
  it("passes a new game, and one whose triggers end with the current turn", () => {
    expect(() => checkTriggers(started())).not.toThrow();
    expect(() => checkTriggers(withPublic(started(), { triggers: [triggerIn(1)] }))).not.toThrow();
  });
  it("catches an active game holding a trigger from an earlier turn", () => {
    const s = withPublic(started(), { turn: 2, triggers: [triggerIn(1)] });
    expect(() => checkTriggers(s)).toThrow(/triggers that do not end with this turn/);
  });
  it("catches a finished game that still holds a trigger", () => {
    const s = withPublic(started(), {
      status: { kind: "over", winner: null, reason: "turnLimitReached" },
      triggers: [triggerIn(1)],
    });
    expect(() => checkTriggers(s)).toThrow(/the game is over, but 1 triggers/);
  });
  it("catches an open play after the turnEnd hook has fired", () => {
    const opened = withPublic(started(), {
      turnEndFired: true,
      pending: [{ id: "d9", side: "lio", kind: "playCardAs", options: {} }],
    });
    expect(() => checkTriggers(opened)).toThrow(/turnEnd hook has already fired/);
  });
});
