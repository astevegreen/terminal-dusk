// Glicko-2 ratings (docs/architecture.md, Rankings; #678), after Mark Glickman, "Example of the Glicko-2 system".
// Pure maths: one rating period in, the player's new rating out. It knows nothing about sides, matches or storage;
// Finalize (#679) maps a finished game to win / draw / loss and stores the three numbers as they come back.
// Values stay as unrounded numbers on the Glicko scale; only displayRating rounds.

/** A player's rating: the rating itself, its deviation (uncertainty) and its volatility. */
export type Glicko2Rating = { rating: number; deviation: number; volatility: number };

/** One game of the rating period, from the rated player's side. */
export type RatedGame = { opponent: Glicko2Rating; score: "win" | "draw" | "loss" };

/** Where every new player starts: Glickman's standard 1500, deviation 350, volatility 0.06. */
export const START_RATING: Readonly<Glicko2Rating> = Object.freeze({ rating: 1500, deviation: 350, volatility: 0.06 });

/** The deviation never drops below this, so an established rating can still move. */
export const DEVIATION_FLOOR = 30;
/** The deviation never grows above the starting value, however long a player is away. */
export const DEVIATION_CEILING = 350;
/** The system constant: how much volatility may change in one period (the paper's example value). */
export const TAU = 0.5;
/** A player is shown as provisional until this many finished ranked games. */
export const PROVISIONAL_GAMES = 10;

const RATING_MIN = 0;
const RATING_MAX = 5000;
const VOLATILITY_MAX = 1;
const SCALE = 173.7178; // 400 / ln(10): converts between the Glicko and Glicko-2 scales
const EPSILON = 0.000001;
const MAX_ROUNDS = 100;
const SCORES = { win: 1, draw: 0.5, loss: 0 } as const;

const inRange = (x: unknown, min: number, max: number): boolean =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;

/**
 * True when `value` is a legal rating: rating in [0, 5000], deviation in [floor, ceiling], volatility in (0, 1].
 * Every rating updateRating returns is legal.
 */
export function isGlicko2Rating(value: unknown): value is Glicko2Rating {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Partial<Glicko2Rating>;
  return (
    inRange(r.rating, RATING_MIN, RATING_MAX) &&
    inRange(r.deviation, DEVIATION_FLOOR, DEVIATION_CEILING) &&
    inRange(r.volatility, 0, VOLATILITY_MAX) &&
    r.volatility !== 0
  );
}

const isRatedGame = (g: unknown): g is RatedGame =>
  typeof g === "object" &&
  g !== null &&
  isGlicko2Rating((g as RatedGame).opponent) &&
  Object.hasOwn(SCORES, (g as RatedGame).score as string);

/** The rating shown to players: a whole number. */
export const displayRating = (r: Glicko2Rating): number => Math.round(r.rating);

/** True before the player's 10th finished ranked game, false from it on. */
export const isProvisional = (rankedGames: number): boolean => rankedGames < PROVISIONAL_GAMES;

const clamp = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x));

/** The new rating, clamped into the legal ranges, back on the Glicko scale. */
const fromScale = (mu: number, phi: number, sigma: number): Glicko2Rating => ({
  rating: clamp(mu * SCALE + 1500, RATING_MIN, RATING_MAX),
  deviation: clamp(phi * SCALE, DEVIATION_FLOOR, DEVIATION_CEILING),
  volatility: clamp(sigma, Number.MIN_VALUE, VOLATILITY_MAX),
});

/** Step 5 of the paper: the new volatility, by the Illinois method, at most MAX_ROUNDS rounds per search. */
function newVolatility(sigma: number, phi: number, v: number, delta: number): number {
  const a = Math.log(sigma * sigma);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0 && k < MAX_ROUNDS) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  for (let round = 0; Math.abs(B - A) > EPSILON && round < MAX_ROUNDS; round++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

/**
 * The player's rating after one rating period. An empty list is a period with no games: only the deviation grows.
 * Null for an illegal player, opponent or score; never a throw, and the inputs are never changed.
 */
export function updateRating(player: Glicko2Rating, games: readonly RatedGame[]): Glicko2Rating | null {
  if (!isGlicko2Rating(player) || !Array.isArray(games) || !games.every(isRatedGame)) return null;
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.deviation / SCALE;
  const sigma = player.volatility;
  if (games.length === 0) return fromScale(mu, Math.sqrt(phi * phi + sigma * sigma), sigma);

  let vInverse = 0;
  let improvement = 0;
  for (const { opponent, score } of games) {
    const phiJ = opponent.deviation / SCALE;
    const g = 1 / Math.sqrt(1 + (3 * phiJ * phiJ) / (Math.PI * Math.PI));
    const expected = 1 / (1 + Math.exp(-g * (mu - (opponent.rating - 1500) / SCALE)));
    vInverse += g * g * expected * (1 - expected);
    improvement += g * (SCORES[score] - expected);
  }
  const v = 1 / vInverse;
  const sigmaNew = newVolatility(sigma, phi, v, v * improvement);
  const phiStar = Math.sqrt(phi * phi + sigmaNew * sigmaNew);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  return fromScale(mu + phiNew * phiNew * improvement, phiNew, sigmaNew);
}
