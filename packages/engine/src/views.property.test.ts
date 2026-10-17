// Property test: over random placeholder games with random hands and draw piles, and random programs
// on the resolution stack, views rebuild the state exactly and never leak hidden data.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, createGame, hiddenPart, reconstruct, SIDES, viewFor } from "./index.ts";
import type { Answer, GameState, Setup, Side, Step } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { choose, forEach, ifYes, marker, passFor, ruleset } from "./test/game.ts";

type Move = { kind: "answer"; yes: boolean } | { kind: "resign"; side: Side } | { kind: "program"; steps: Step[] };
type Game = { setup: Setup; seed: string; moves: Move[] };

/**
 * A small random block, nested up to `depth` levels. Every `if` follows the `choose` that binds its
 * variable, and markers name only a variable in scope, so every program is valid.
 */
function blockArb(depth: number): fc.Arbitrary<Step[]> {
  const parts: fc.Arbitrary<Step[]>[] = [fc.constant([marker("m")])];
  if (depth > 0) {
    const who = fc.constantFrom(...SIDES);
    const over = fc.array(fc.constantFrom("a", "b", "c"), { maxLength: 3 });
    parts.push(
      fc
        .tuple(who, blockArb(depth - 1), blockArb(depth - 1))
        .map(([side, then, otherwise]) => [choose("c", side), ifYes("c", then, otherwise), marker("v", "c")]),
      fc.tuple(over, blockArb(depth - 1)).map(([items, body]) => [forEach(items, "x", [marker("i", "x"), ...body])]),
    );
  }
  return fc.array(fc.oneof(...parts), { maxLength: 3 }).map((blocks) => blocks.flat());
}
const programArb = blockArb(3);

const moveArb: fc.Arbitrary<Move> = fc.oneof(
  { arbitrary: fc.boolean().map((yes): Move => ({ kind: "answer", yes })), weight: 6 },
  { arbitrary: programArb.map((steps): Move => ({ kind: "program", steps })), weight: 3 },
  { arbitrary: fc.constantFrom(...SIDES).map((side): Move => ({ kind: "resign", side })), weight: 1 },
);

/** Card IDs are unique, quoted tokens ("card12z"), so a leak check cannot match part of another value. */
const gameArb: fc.Arbitrary<Game> = fc
  .record({
    ids: fc.uniqueArray(fc.integer({ min: 0, max: 9999 }), { maxLength: 30 }),
    cutA: fc.nat(),
    cutB: fc.nat(),
    rounds: fc.integer({ min: 1, max: 5 }),
    seed: fc.nat(),
    moves: fc.array(moveArb, { maxLength: 20 }),
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

/** The answer a move gives to the open decision: pass, or yes/no for a paused program. */
function answerFor(s: GameState, move: Extract<Move, { kind: "answer" }>): Answer {
  const d = s.public.pending[0]!;
  return d.kind === "yesNo"
    ? { decisionId: d.id, side: d.side, value: { kind: "yesNo", yes: move.yes } }
    : passFor(s, d.side);
}

/** Every state the game passes through. A program starts only when none is running. */
function play(game: Game): GameState[] {
  const created = createGame(ruleset, game.setup, game.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  const states = [deepFreeze(created.value.state)];
  for (const move of game.moves) {
    const s = states[states.length - 1]!;
    if (s.public.status.kind === "over") break;
    if (move.kind === "program" && s.public.stack.length > 0) continue;
    const r =
      move.kind === "program"
        ? startProgram(ruleset, s, move.steps)
        : apply(ruleset, s, move.kind === "resign" ? { system: "resign", side: move.side } : answerFor(s, move));
    if (!r.ok) throw new Error(`move rejected: ${r.error.code}`);
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
  it("the random games really pause programs on the stack", () => {
    const paused = fc
      .sample(gameArb, { numRuns: 200, seed: 1 })
      .flatMap(play)
      .filter((s) => s.public.stack.length > 1);
    expect(paused.length).toBeGreaterThan(20);
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
