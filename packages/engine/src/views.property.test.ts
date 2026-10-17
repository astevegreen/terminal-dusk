// Property test: over random placeholder games with random hands and draw piles, views rebuild the
// state exactly and never leak hidden data.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, createGame, hiddenPart, reconstruct, SIDES, viewFor } from "./index.ts";
import type { Answer, GameState, Setup, Side } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { passFor, ruleset } from "./test/game.ts";

type Move = "pass" | "resignLio" | "resignSae";
type Game = { setup: Setup; seed: string; moves: Move[] };

/** Card IDs are unique, quoted tokens ("card12z"), so a leak check cannot match part of another value. */
const gameArb: fc.Arbitrary<Game> = fc
  .record({
    ids: fc.uniqueArray(fc.integer({ min: 0, max: 9999 }), { maxLength: 30 }),
    cutA: fc.nat(),
    cutB: fc.nat(),
    rounds: fc.integer({ min: 1, max: 5 }),
    seed: fc.nat(),
    moves: fc.array(fc.constantFrom<Move>("pass", "pass", "pass", "pass", "pass", "resignLio", "resignSae"), {
      maxLength: 15,
    }),
  })
  .map(({ ids, cutA, cutB, rounds, seed, moves }) => {
    const cards = ids.map((n) => `card${n}z`);
    const a = cutA % (cards.length + 1);
    const b = a + (cutB % (cards.length - a + 1));
    const setup: Setup = {
      seedHash: "hash-of-seed",
      hands: { lio: cards.slice(0, a), sae: cards.slice(a, b) },
      deck: cards.slice(b),
      rounds,
    };
    return { setup, seed: `seed-${seed}-x`, moves };
  });

function play(game: Game): GameState[] {
  const created = createGame(ruleset, game.setup, game.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  const states = [deepFreeze(created.value.state)];
  for (const move of game.moves) {
    const s = states[states.length - 1]!;
    const side = s.public.pending[0]?.side;
    if (!side) break;
    const resigner: Side = move === "resignLio" ? "lio" : "sae";
    const answer: Answer = move === "pass" ? passFor(s, side) : { system: "resign", side: resigner };
    const r = apply(ruleset, s, answer);
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    states.push(deepFreeze(r.value.state));
  }
  return states;
}

/** Hidden values found in a viewer's JSON: generator words, the seed, draw-pile cards and unseen hands. */
function leaks(s: GameState, viewer: Side | "spectator", game: Game): string[] {
  const json = JSON.stringify(viewFor(s, viewer));
  const tokens = new Set(json.match(/-?\d+|"[^"]*"/g) ?? []);
  // Words below 2^16 cannot be told apart from small game counters, and occur about once in 65,000 words.
  const rngWords = s.secret.rng.filter((w) => w >= 65536).map(String);
  const unseenHands = SIDES.filter((side) => side !== viewer).flatMap((side) => s.private[side].hand);
  const cards = [...s.secret.deck, ...unseenHands].map((c) => `"${c}"`);
  const found = [...rngWords, ...cards].filter((t) => tokens.has(t));
  if (json.includes(game.seed)) found.push(game.seed);
  if (json.includes('"rng"')) found.push('"rng"');
  return found;
}

describe("views over random games", () => {
  it("reconstruct(viewFor(s, x), hiddenPart(s, x)) deep-equals s after every step, for both sides", () => {
    fc.assert(
      fc.property(gameArb, (game) => {
        for (const s of play(game)) {
          for (const side of SIDES) {
            expect(reconstruct(viewFor(s, side), hiddenPart(s, side))).toStrictEqual(s);
          }
        }
      }),
      { numRuns: 300 },
    );
  });
  it("no view for lio, sae or spectator contains generator state, the seed, a draw-pile card or an unseen hand card", () => {
    fc.assert(
      fc.property(gameArb, (game) => {
        for (const s of play(game)) {
          for (const viewer of [...SIDES, "spectator"] as const) expect(leaks(s, viewer, game)).toEqual([]);
        }
      }),
      { numRuns: 300 },
    );
  });
  it("the leak check itself finds a hidden card when one is planted in a view", () => {
    const game = fc.sample(gameArb, { numRuns: 1, seed: 7 })[0]!;
    const s = play({ ...game, setup: { ...game.setup, deck: ["card1z"] } })[0]!;
    const planted = { ...s, public: { ...s.public, discard: ["card1z"] } };
    expect(leaks(planted, "spectator", game)).toContain('"card1z"');
  });
});
