// Tests for the passed-plays check (passedPlays.ts), on the real step of found game 427 where LIO passes a play
// because a discard took its last card: the check passes that step and a card drawn after the pass, and fails a
// missing, extra or misnamed playPassed event, a pass with a card still in hand, and a plays counter that fell.
import { apply, createGame } from "@terminal-dusk/engine";
import type { Answer, GameEvent, GameState } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { firstExtraStepsRuleset } from "./extraSteps.ts";
import { FOUND_GAMES } from "./foundGames.ts";
import { checkPassedPlays } from "./passedPlays.ts";

type PassStep = { prior: GameState; answer: Answer; events: GameEvent[]; state: GameState };

/** The first step of found game 427 with a playPassed event, each part a copy the test may change. */
function passStep(): PassStep {
  const game = FOUND_GAMES.find((found) => found.name.startsWith("extra-steps game 427"));
  if (game === undefined) throw new Error("found game 427 is missing");
  const created = createGame(firstExtraStepsRuleset, game.record.setup, game.record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  for (const answer of game.record.answers) {
    const r = apply(firstExtraStepsRuleset, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    if (r.value.events.some((event) => event.kind === "playPassed")) {
      // State and events are plain JSON (architecture rule 5), so this is a full copy the test may change.
      const step = { prior: state, answer, events: r.value.events, state: r.value.state };
      return JSON.parse(JSON.stringify(step)) as PassStep;
    }
    state = r.value.state;
  }
  throw new Error("found game 427 has no passed play");
}

const check = ({ prior, answer, events, state }: PassStep): void => checkPassedPlays(prior, answer, events, state);
const passAt = (events: readonly GameEvent[]): number => events.findIndex((event) => event.kind === "playPassed");

describe("the passed-plays check", () => {
  it("passes the real step: LIO's first play passed, its hand empty", () => {
    const step = passStep();
    expect(step.events.filter((event) => event.kind === "playPassed")).toEqual([
      { kind: "playPassed", visibility: "public", side: "lio" },
    ]);
    expect(step.state.private.lio.hand).toEqual([]);
    expect(() => check(step)).not.toThrow();
  });

  it("passes a card the passing side drew after the pass", () => {
    const step = passStep();
    step.events.push({
      kind: "cardDrawn",
      visibility: "lio",
      side: "lio",
      card: "c1",
      publicForm: { kind: "cardDrawnHidden", visibility: "public", side: "lio" },
    });
    step.state.private.lio.hand.push("c1");
    expect(() => check(step)).not.toThrow();
  });

  it("fails a passed play with no playPassed event", () => {
    const step = passStep();
    step.events.splice(passAt(step.events), 1);
    expect(() => check(step)).toThrow("the plays counter shows 1 passed plays, but 0 playPassed events came");
  });

  it("fails a playPassed event with no passed play", () => {
    const step = passStep();
    step.events.push({ kind: "playPassed", visibility: "public", side: "sae" });
    expect(() => check(step)).toThrow("the plays counter shows 1 passed plays, but 2 playPassed events came");
  });

  it("fails a playPassed event naming the side whose play it was not", () => {
    const step = passStep();
    step.events[passAt(step.events)] = { kind: "playPassed", visibility: "public", side: "sae" };
    expect(() => check(step)).toThrow("names sae, but the passed play was lio's");
  });

  it("fails a pass by a side that still holds a card it did not draw since", () => {
    const step = passStep();
    step.state.private.lio.hand.push("c1");
    expect(() => check(step)).toThrow("lio passed a play at event");
  });

  it("fails a plays counter that fell", () => {
    const step = passStep();
    step.prior.public.playsMade = 2;
    expect(() => check(step)).toThrow("the plays counter fell by 1");
  });
});
