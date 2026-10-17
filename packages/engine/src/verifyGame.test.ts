import { describe, expect, it } from "vitest";
import { apply, createGame, legalAnswers, seedHash, verifyGame } from "./index.ts";
import type { Answer, GameEvent, GameState, Ruleset, Setup } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { makeSetup, ruleset } from "./test/game.ts";

const SEED = "verify-seed-1";
const setup = makeSetup(2, 1, SEED);

/** The real game by hand: the first open decision gets its first legal answer, until the game is over. */
function playByHand(): { answers: Answer[]; state: GameState; events: GameEvent[] } {
  const start = createGame(ruleset, setup, SEED);
  if (!start.ok) throw new Error("createGame failed");
  let { state } = start.value;
  const events = [...start.value.events];
  const answers: Answer[] = [];
  while (state.public.status.kind === "active") {
    const d = state.public.pending[0]!;
    const answer: Answer = { decisionId: d.id, side: d.side, value: legalAnswers(ruleset, state, d.side)[0]! };
    const r = apply(ruleset, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    answers.push(answer);
    state = r.value.state;
    events.push(...r.value.events);
  }
  return { answers, state, events };
}

const game = playByHand();

describe("verifyGame", () => {
  it("the fixed game has at least 5 answers and ends", () => {
    expect(game.answers.length).toBeGreaterThanOrEqual(5);
    expect(game.state.public.status.kind).toBe("over");
  });

  it("accepts a full, correct log: the final state and every event, in order, match doing it by hand", () => {
    const r = verifyGame(ruleset, setup, SEED, game.answers);
    expect(r).toEqual({ ok: true, value: { state: game.state, events: game.events } });
  });

  it("a different seed gives seedMismatch, and no answer runs", () => {
    const r = verifyGame(ruleset, setup, "another-seed", game.answers);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("seedMismatch");
      expect(r.error.message ?? "").not.toContain("another-seed");
    }
  });

  it.each([
    ["an empty log", []],
    ["a log with its last answer removed", game.answers.slice(0, -1)],
  ])("%s gives unfinishedLog", (_name, answers) => {
    const r = verifyGame(ruleset, setup, SEED, answers);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("unfinishedLog");
      expect(r.error.message ?? "").not.toContain(SEED);
    }
  });

  it("answer 2 with a changed decisionId gives unknownDecision, naming 'Answer 2 of <total>'", () => {
    const answers = game.answers.map((a, i) => (i === 1 ? { ...a, decisionId: "no-such-decision" } : a));
    const r = verifyGame(ruleset, setup, SEED, answers);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("unknownDecision");
      expect(r.error.message).toMatch(new RegExp(`^Answer 2 of ${answers.length}`));
      expect(r.error.message).not.toContain(SEED);
    }
  });

  it("an answer added after the game ended gives gameOver, naming 'Answer <n> of <n>'", () => {
    const answers = [...game.answers, game.answers[0]!];
    const r = verifyGame(ruleset, setup, SEED, answers);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("gameOver");
      expect(r.error.message).toMatch(new RegExp(`^Answer ${answers.length} of ${answers.length}`));
      expect(r.error.message).not.toContain(SEED);
    }
  });

  it("stops at the first refused answer: later answers never run", () => {
    const answers = game.answers.map((a, i) => (i === 1 ? { ...a, decisionId: "no-such-decision" } : a));
    const r = verifyGame(ruleset, setup, SEED, [...answers, ...answers]);
    expect(!r.ok && r.error.message).toMatch(/^Answer 2 of /);
  });

  it("never changes its inputs: the ruleset, setup and answers can be deep-frozen", () => {
    const frozen = deepFreeze(
      JSON.parse(JSON.stringify({ ruleset, setup, answers: game.answers })) as {
        ruleset: Ruleset;
        setup: Setup;
        answers: Answer[];
      },
    );
    const r = verifyGame(frozen.ruleset, frozen.setup, SEED, frozen.answers);
    expect(r).toEqual({ ok: true, value: { state: game.state, events: game.events } });
  });

  it("the setup's seedHash is what the seed is checked against", () => {
    expect(setup.seedHash).toBe(seedHash(SEED));
  });
});
