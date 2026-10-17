import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { nextInt, seedRng, shuffle, type RngState } from "./rng.ts";

function deepFreeze<T>(x: T): T {
  if (x && typeof x === "object") {
    Object.freeze(x);
    for (const v of Object.values(x)) deepFreeze(v);
  }
  return x;
}

const inRange = (s: RngState) => s.length === 4 && s.every((w) => Number.isInteger(w) && w >= 0 && w <= 4294967295);

const seedArb = fc.string({ maxLength: 40 });
const nArb = fc.integer({ min: 1, max: 2 ** 31 });
const params = { numRuns: 200 };

describe("rng: seeding", () => {
  it("the same seed string always gives the same starting state", () => {
    expect(seedRng("terminal-dusk")).toEqual(seedRng("terminal-dusk"));
    expect(seedRng("a")).not.toEqual(seedRng("b"));
  });
  it("the starting state is plain JSON: four unsigned 32-bit integers", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const s = seedRng(seed);
        expect(inRange(s)).toBe(true);
        expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      }),
      params,
    );
  });
});

describe("rng: nextInt", () => {
  it("n = 1 always gives 0", () => {
    let s = seedRng("one");
    for (let i = 0; i < 50; i++) {
      const r = nextInt(s, 1);
      expect(r.value).toBe(0);
      s = r.state;
    }
  });
  it("n = 2^31 works with no 32-bit overflow and stays in range", () => {
    let s = seedRng("big");
    for (let i = 0; i < 200; i++) {
      const r = nextInt(s, 2 ** 31);
      expect(Number.isInteger(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(2 ** 31);
      s = r.state;
    }
  });
  it("never changes its input state", () => {
    const s = deepFreeze(seedRng("frozen"));
    const copy = [...s];
    nextInt(s, 10);
    expect([...s]).toEqual(copy);
  });
  it("throws RangeError for a non-integer n", () => {
    expect(() => nextInt(seedRng("x"), 1.5)).toThrow(RangeError);
  });
  it("throws RangeError for n below 1", () => {
    expect(() => nextInt(seedRng("x"), 0)).toThrow(RangeError);
  });
  it("throws RangeError for n above 2^31", () => {
    expect(() => nextInt(seedRng("x"), 2 ** 31 + 1)).toThrow(RangeError);
  });
  it("golden: first 20 values of nextInt(_, 1000) for seed terminal-dusk", () => {
    let s = seedRng("terminal-dusk");
    const values: number[] = [];
    for (let i = 0; i < 20; i++) {
      const r = nextInt(s, 1000);
      values.push(r.value);
      s = r.state;
    }
    expect(values).toEqual([
      688, 690, 96, 993, 444, 11, 220, 18, 966, 149, 382, 456, 441, 75, 924, 518, 856, 382, 485, 586,
    ]);
  });
  it("property: value is an integer in [0, n) and the state stays unsigned 32-bit after every call", () => {
    fc.assert(
      fc.property(seedArb, nArb, (seed, n) => {
        let s = seedRng(seed);
        for (let i = 0; i < 20; i++) {
          const r = nextInt(s, n);
          expect(Number.isInteger(r.value)).toBe(true);
          expect(r.value).toBeGreaterThanOrEqual(0);
          expect(r.value).toBeLessThan(n);
          expect(inRange(r.state)).toBe(true);
          s = r.state;
        }
      }),
      params,
    );
  });
  it("property: the same seed always gives the same sequence", () => {
    fc.assert(
      fc.property(seedArb, nArb, (seed, n) => {
        const run = () => {
          let s = seedRng(seed);
          const out: number[] = [];
          for (let i = 0; i < 10; i++) {
            const r = nextInt(s, n);
            out.push(r.value);
            s = r.state;
          }
          return out;
        };
        expect(run()).toEqual(run());
      }),
      params,
    );
  });
});

describe("rng: shuffle", () => {
  it("shuffling an empty array gives an empty array", () => {
    const s = seedRng("e");
    const r = shuffle(s, []);
    expect(r.items).toEqual([]);
    expect(r.state).toEqual(s);
  });
  it("never changes its inputs (deep-frozen)", () => {
    const s = deepFreeze(seedRng("f"));
    const items = deepFreeze([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
    const r = shuffle(s, items);
    expect(r.items).toHaveLength(4);
    expect(items.map((i) => i.id)).toEqual([1, 2, 3, 4]);
  });
  it("property: returns a permutation of its input, repeatably, with a valid state", () => {
    fc.assert(
      fc.property(seedArb, fc.array(fc.integer(), { maxLength: 30 }), (seed, items) => {
        const a = shuffle(seedRng(seed), items);
        const b = shuffle(seedRng(seed), items);
        expect(a).toEqual(b);
        expect([...a.items].sort((x, y) => x - y)).toEqual([...items].sort((x, y) => x - y));
        expect(inRange(a.state)).toBe(true);
      }),
      params,
    );
  });
});
