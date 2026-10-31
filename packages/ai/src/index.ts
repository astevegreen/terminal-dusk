// Public entry point of the AI opponent (docs/architecture.md, Decision 8).
export { easyAnswer } from "./easy.ts";
export { mediumAnswer } from "./medium.ts";
export { hardAnswer } from "./hard.ts";
export { guessHidden } from "./guess.ts";
export { EASY_WEIGHTS } from "./weights/easy.ts";
export { MEDIUM_WEIGHTS } from "./weights/medium.ts";
export { HARD_WEIGHTS } from "./weights/hard.ts";
export { seededRandom } from "./random.ts";
export { createEasyPlayer, createHardPlayer, createMediumPlayer, createAiWorkerHandler } from "./player.ts";
export type { AiRequest, AiResponse, AiTier, PlayerOptions } from "./player.ts";
export type { Clock } from "./hard.ts";
export type { HardWeights, MediumWeights, Weights } from "./types.ts";
