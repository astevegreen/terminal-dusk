// Shared types of the AI package.

/** How the evaluation weighs what it knows. Plain numbers, so a tier is just a data object. */
export type Weights = { ops: number; rivalCard: number; noise: number };

/**
 * The Medium tier's weights: Easy's three, plus how it values the board it would leave (evaluate.ts) and Escalation
 * (safety.ts). `region`: per point of era-end region scoring it leads by. `progress`: per country, per share of the way
 * to controlling it. `battleground`: a battleground country counts 1 + this times as much as another; a country on
 * only a later era's list counts that times `later`. `closed`: a closed region's terms count 1 + this times as much
 * (half of it for the region closing at the next Escalation level). `crisis`: per point of score a self-caused
 * crisis is expected to cost. `trap`: for raising Escalation to where the share of unseen cards that would cause the
 * rival a crisis is 1. `tech`: per step the tech race marker leans the side's way. `techBonus`: for holding a
 * first-there +1 on the next tech race draw. `techRealign`, `techIntervene`, `techExtraPlay`, `techOpening`: for
 * holding each step's power (docs/design/tech-race.md, "What each step gives"): +1 in realignments, +1 to
 * interventions, Hypersonics' extra play, and seeing the rival's opening card first.
 */
export type MediumWeights = Weights & {
  region: number;
  progress: number;
  battleground: number;
  later: number;
  closed: number;
  crisis: number;
  trap: number;
  tech: number;
  techBonus: number;
  techRealign: number;
  techIntervene: number;
  techExtraPlay: number;
  techOpening: number;
};

/**
 * The Hard tier's weights: Medium's, plus the size of its search (hard.ts). `guesses`: how many hidden parts it
 * guesses. `candidates`: how many of Medium's best card answers it tries on each. `rounds`: how many more card
 * plays each side makes in a rollout (rollout.ts). `timeMs`: when a clock is given, the search stops once this many
 * milliseconds have passed, keeping the guesses already finished.
 */
export type HardWeights = MediumWeights & { guesses: number; candidates: number; rounds: number; timeMs: number };
