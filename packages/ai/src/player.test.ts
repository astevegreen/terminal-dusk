import { viewFor } from "@terminal-dusk/engine";
import type { AnswerValue } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyAnswer } from "./easy.ts";
import { createAiWorkerHandler, createEasyPlayer } from "./player.ts";
import type { AiRequest } from "./player.ts";
import { seededRandom } from "./random.ts";
import { newGame, ruleset } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const view = viewFor(newGame(7), "lio");
const ASKS = 12;

/** Several equal-scoring answers: the first card in hand could be any with the same printed ops. */
function ask(player: (v: typeof view) => AnswerValue | null): (AnswerValue | null)[] {
  return Array.from({ length: ASKS }, () => player(view));
}

describe("the Easy player", () => {
  it("gives the same answers to the same views for the same seed", () => {
    expect(ask(createEasyPlayer(ruleset, "lio", 3))).toEqual(ask(createEasyPlayer(ruleset, "lio", 3)));
  });

  it("can give different answers for different seeds", () => {
    const runs = [1, 2, 3, 4, 5, 6].map((seed) => JSON.stringify(ask(createEasyPlayer(ruleset, "lio", seed))));
    expect(new Set(runs).size).toBeGreaterThan(1);
  });

  it("keeps its noise going between calls instead of restarting", () => {
    const answers = ask(createEasyPlayer(ruleset, "lio", 5));
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBeGreaterThan(1);
    const random = seededRandom(5);
    const reference = Array.from({ length: ASKS }, () => easyAnswer(ruleset, view, "lio", EASY_WEIGHTS, random));
    expect(answers).toEqual(reference);
  });
});

describe("the AI worker handler", () => {
  const start = (seed: number): AiRequest => ({ kind: "start", ruleset, side: "lio", seed });
  const askAll = (handler: ReturnType<typeof createAiWorkerHandler>) =>
    Array.from({ length: ASKS }, (_, id) => handler({ kind: "answer", id, view }));

  it("answers with the request's id", () => {
    const handler = createAiWorkerHandler();
    expect(handler(start(1))).toBeNull();
    const response = handler({ kind: "answer", id: 42, view });
    expect(response?.kind).toBe("answer");
    expect(response?.id).toBe(42);
    expect(response?.value).not.toBeNull();
  });

  it("gives value null for an answer before any start", () => {
    expect(createAiWorkerHandler()({ kind: "answer", id: 9, view })).toEqual({ kind: "answer", id: 9, value: null });
  });

  it("gives the same values as createEasyPlayer with the same seed", () => {
    const handler = createAiWorkerHandler();
    handler(start(8));
    expect(askAll(handler).map((r) => r?.value)).toEqual(ask(createEasyPlayer(ruleset, "lio", 8)));
  });

  it("restarts the noise on a second start with the same seed", () => {
    const handler = createAiWorkerHandler();
    handler(start(8));
    const first = askAll(handler);
    handler(start(8));
    expect(askAll(handler)).toEqual(first);
  });

  it("follows the new seed after a second start with a new seed", () => {
    const handler = createAiWorkerHandler();
    handler(start(8));
    askAll(handler);
    handler(start(21));
    expect(askAll(handler).map((r) => r?.value)).toEqual(ask(createEasyPlayer(ruleset, "lio", 21)));
  });
});
