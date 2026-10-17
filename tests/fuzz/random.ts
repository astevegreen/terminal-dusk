// The fuzz suite's own seeded generator, so every random game can be played again exactly. Never Math.random.
// The engine's generator is internal to the engine, so the suite keeps a separate one.
//
// ALGORITHM: mulberry32, by Tommy Ettinger (public domain). Changing it changes which games each seed plays,
// which is harmless: a failing game is kept by its printed record, not by its seed (see fixedGames.ts).

const TWO_32 = 4294967296;

export type Rng = {
  /** A whole number from 0 to n - 1, each equally likely. `n` is a whole number from 1 to 2^32. */
  readonly int: (n: number) => number;
};

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    int(n) {
      if (!Number.isInteger(n) || n < 1 || n > TWO_32)
        throw new Error(`int needs a whole number from 1 to 2^32, not ${n}`);
      // Draws at or above the last whole multiple of n are thrown away, so every result is equally likely.
      const limit = TWO_32 - (TWO_32 % n);
      let x = next();
      while (x >= limit) x = next();
      return x % n;
    },
  };
}
