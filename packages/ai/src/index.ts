// Public entry point of the AI opponent (docs/architecture.md, Decision 8).
export { easyAnswer } from "./easy.ts";
export { mediumAnswer } from "./medium.ts";
export { guessHidden } from "./guess.ts";
export { EASY_WEIGHTS } from "./weights/easy.ts";
export { MEDIUM_WEIGHTS } from "./weights/medium.ts";
export { seededRandom } from "./random.ts";
export { createEasyPlayer, createMediumPlayer, createAiWorkerHandler } from "./player.ts";
export type { AiRequest, AiResponse, AiTier } from "./player.ts";
export type { MediumWeights, Weights } from "./types.ts";
