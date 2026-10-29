// A ready-made Easy player and the plain-data protocol a worker uses to run it (Decision 8).
import type { AnswerValue, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";
import { easyAnswer } from "./easy.ts";
import { mediumAnswer } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

/** An Easy player for `side` whose noise (one seeded generator) carries on from move to move. */
export function createEasyPlayer(ruleset: Ruleset, side: Side, seed: number): (view: PlayerView) => AnswerValue | null {
  const random = seededRandom(seed);
  return (view) => easyAnswer(ruleset, view, side, EASY_WEIGHTS, random);
}

/** A Medium player for `side`, built the same way as the Easy one. */
export function createMediumPlayer(
  ruleset: Ruleset,
  side: Side,
  seed: number,
): (view: PlayerView) => AnswerValue | null {
  const random = seededRandom(seed);
  return (view) => mediumAnswer(ruleset, view, side, MEDIUM_WEIGHTS, random);
}

export type AiTier = "easy" | "medium";

/** `tier` is Easy when left out. */
export type AiRequest =
  | { kind: "start"; ruleset: Ruleset; side: Side; seed: number; tier?: AiTier }
  | { kind: "answer"; id: number; view: PlayerView };

export type AiResponse = { kind: "answer"; id: number; value: AnswerValue | null };

/** The worker's logic as a plain function: `start` makes the player, `answer` asks it. */
export function createAiWorkerHandler(): (request: AiRequest) => AiResponse | null {
  let player: ((view: PlayerView) => AnswerValue | null) | null = null;
  return (request) => {
    if (request.kind === "start") {
      const make = request.tier === "medium" ? createMediumPlayer : createEasyPlayer;
      player = make(request.ruleset, request.side, request.seed);
      return null;
    }
    return { kind: "answer", id: request.id, value: player ? player(request.view) : null };
  };
}
