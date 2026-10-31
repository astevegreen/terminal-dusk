// Ready-made Easy, Medium and Hard players and the plain-data protocol a worker uses to run them (Decision 8).
import type { AnswerValue, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";
import { easyAnswer } from "./easy.ts";
import { hardAnswer } from "./hard.ts";
import type { Clock } from "./hard.ts";
import { mediumAnswer } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";
import { HARD_WEIGHTS } from "./weights/hard.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

/** What a player can be given besides its seed. `now`: a clock that lets Hard stop its search on time. */
export type PlayerOptions = { now?: Clock };

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

/** A Hard player for `side`, built the same way; with no clock its search always runs to its full size. */
export function createHardPlayer(
  ruleset: Ruleset,
  side: Side,
  seed: number,
  options: PlayerOptions = {},
): (view: PlayerView) => AnswerValue | null {
  const random = seededRandom(seed);
  return (view) => hardAnswer(ruleset, view, side, HARD_WEIGHTS, random, options.now);
}

export type AiTier = "easy" | "medium" | "hard";

/** `tier` is Easy when left out. */
export type AiRequest =
  | { kind: "start"; ruleset: Ruleset; side: Side; seed: number; tier?: AiTier }
  | { kind: "answer"; id: number; view: PlayerView };

export type AiResponse = { kind: "answer"; id: number; value: AnswerValue | null };

/** The worker's logic as a plain function: `start` makes the player, `answer` asks it. `options` goes to Hard. */
export function createAiWorkerHandler(options: PlayerOptions = {}): (request: AiRequest) => AiResponse | null {
  let player: ((view: PlayerView) => AnswerValue | null) | null = null;
  return (request) => {
    if (request.kind === "start") {
      const { ruleset, side, seed } = request;
      if (request.tier === "hard") player = createHardPlayer(ruleset, side, seed, options);
      else if (request.tier === "medium") player = createMediumPlayer(ruleset, side, seed);
      else player = createEasyPlayer(ruleset, side, seed);
      return null;
    }
    return { kind: "answer", id: request.id, value: player ? player(request.view) : null };
  };
}
