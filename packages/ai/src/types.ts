// Shared types of the AI package.

/** How the evaluation weighs what it knows. Plain numbers, so a tier is just a data object. */
export type Weights = { ops: number; rivalCard: number; noise: number };
