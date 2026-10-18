// Public entry point of the AI opponent (docs/architecture.md, Decision 8).
export { easyAnswer } from "./easy.ts";
export { guessHidden } from "./guess.ts";
export { EASY_WEIGHTS } from "./weights/easy.ts";
export { seededRandom } from "./random.ts";
export { createEasyPlayer, createAiWorkerHandler } from "./player.ts";
export type { AiRequest, AiResponse } from "./player.ts";
export type { Weights } from "./types.ts";
