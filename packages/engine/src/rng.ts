// Seeded random numbers for the rules engine.
//
// ALGORITHM: sfc32 (Small Fast Counting, 32-bit), by Chris Doty-Humphrey (public domain, from PractRand).
// THIS ALGORITHM MUST NEVER CHANGE. Saved games and golden replays depend on the exact number sequence;
// changing a single line here would make every recorded game replay differently.
//
// Everything is integer arithmetic. No Math.random, no Date, no floating-point results.
// The generator state is plain JSON: four integers, each in 0..2^32-1 (always coerced with `>>> 0`).
// Internal to the engine: index.ts does not export this file.

export type RngState = readonly [number, number, number, number];

const TWO_32 = 4294967296;
const MAX_N = 2147483648; // 2^31

/**
 * SEED METHOD (must never change): the seed string is mixed with a four-lane integer hash
 * (a variant of cyrb128: Math.imul by fixed odd constants and xor-shifts over each UTF-16 code unit),
 * which gives the four starting words. The final step differs from real cyrb128: after the four
 * finishing mixes, the words are [h1^h2^h3^h4, h2^h1, h3^h1, h4^h1] where h1 is the value from
 * those finishing mixes (real cyrb128 XORs in the already-combined first word). Then 15 values are thrown away so a poor seed still starts well.
 * The same string always gives the same state.
 */
export function seedRng(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  let state: RngState = [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
  for (let i = 0; i < 15; i++) state = step(state).state;
  return state;
}

/** One sfc32 step: returns an unsigned 32-bit integer and the new state. Never changes its input. */
function step(state: RngState): { value: number; state: RngState } {
  const a = state[0];
  const b = state[1];
  const c = state[2];
  const d = state[3];
  const t = (((a + b) >>> 0) + d) >>> 0;
  const nd = (d + 1) >>> 0;
  const na = (b ^ (b >>> 9)) >>> 0;
  const nb = (c + (c << 3)) >>> 0;
  const nc = (((c << 21) | (c >>> 11)) + t) >>> 0;
  return { value: t, state: [na, nb, nc, nd] };
}

/**
 * Returns an integer in [0, n) for an integer n from 1 to 2^31, and the new state.
 * Rejection sampling: raw values at or above the largest multiple of n that fits in 2^32 are redrawn,
 * so no result is favoured. Throws RangeError for a bad n (a programming error, not a game event).
 */
export function nextInt(state: RngState, n: number): { value: number; state: RngState } {
  if (!Number.isInteger(n) || n < 1 || n > MAX_N) {
    throw new RangeError(`nextInt needs an integer n from 1 to 2^31, got ${n}`);
  }
  // Plain number arithmetic is exact here: every value stays below 2^53.
  const limit = TWO_32 - (TWO_32 % n);
  let current = state;
  for (;;) {
    const drawn = step(current);
    current = drawn.state;
    if (drawn.value < limit) return { value: drawn.value % n, state: current };
  }
}

/** Fisher-Yates shuffle built on nextInt. Returns a new array; the input array and state are untouched. */
export function shuffle<T>(state: RngState, items: readonly T[]): { items: T[]; state: RngState } {
  const out = items.slice();
  let current = state;
  for (let i = out.length - 1; i > 0; i--) {
    const drawn = nextInt(current, i + 1);
    current = drawn.state;
    const j = drawn.value;
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return { items: out, state: current };
}
