// Property test: over random games with random hands and draw piles, and random programs
// on the resolution stack (some with simultaneous pairs), views rebuild the state exactly and never
// leak hidden data, including a side's unrevealed pick.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, createGame, hiddenPart, legalAnswers, reconstruct, seedHash, SIDES, viewFor } from "./index.ts";
import type { Answer, GameState, PlayerView, Ruleset, Setup, Side, Step, Viewer } from "./index.ts";
import { startProgram } from "./stack.ts";
import { DECKS } from "./types.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { choose, forEach, ifSaid, ifYes, marker, rulesetWith } from "./test/game.ts";

/** An answer move answers the open decision at index `which` (mod the number open), with `yes` or the card at `pick`. */
type Move =
  | { kind: "answer"; yes: boolean; which: number; pick: number }
  | { kind: "resign"; side: Side }
  | { kind: "program"; steps: Step[] };
type Game = { setup: Setup; seed: string; moves: Move[] };

/**
 * A small random block, nested up to `depth` levels. Every `if` follows the `choose` that binds its
 * variable (naming a side when both sides chose), and markers name only a variable in scope, so every
 * program is valid.
 */
function blockArb(depth: number): fc.Arbitrary<Step[]> {
  const parts: fc.Arbitrary<Step[]>[] = [fc.constant([marker("m")])];
  if (depth > 0) {
    const who = fc.constantFrom<Side | "both">(...SIDES, "both");
    const over = fc.array(fc.constantFrom("a", "b", "c"), { maxLength: 3 });
    parts.push(
      fc
        .tuple(who, fc.constantFrom(...SIDES), blockArb(depth - 1), blockArb(depth - 1))
        .map(([chooser, side, then, otherwise]) => [
          choose("c", chooser),
          chooser === "both" ? ifSaid(side, "c", then, otherwise) : ifYes("c", then, otherwise),
          marker("v", "c"),
        ]),
      fc.tuple(over, blockArb(depth - 1)).map(([items, body]) => [forEach(items, "x", [marker("i", "x"), ...body])]),
    );
  }
  return fc.array(fc.oneof(...parts), { maxLength: 3 }).map((blocks) => blocks.flat());
}
const programArb = blockArb(3);

const moveArb: fc.Arbitrary<Move> = fc.oneof(
  {
    arbitrary: fc
      .record({ yes: fc.boolean(), which: fc.nat(), pick: fc.nat() })
      .map((a): Move => ({ kind: "answer", ...a })),
    weight: 6,
  },
  { arbitrary: programArb.map((steps): Move => ({ kind: "program", steps })), weight: 3 },
  { arbitrary: fc.constantFrom(...SIDES).map((side): Move => ({ kind: "resign", side })), weight: 1 },
);

/** Most turns any random game has, and most plays per turn: each side needs up to 3 x (1 + 2) = 9 cards. */
const MAX_TURNS = 3;
const MAX_PLAYS = 2;
const MOST_NEEDED = MAX_TURNS * (1 + MAX_PLAYS);
/** The rulesetWith affiliation of the nth card: "l..." is LIO's, "s..." SAE's, "n..." neutral. */
const PREFIXES = ["l", "s", "n"];

/**
 * A Contingency deck as a setup gives it: 3-8 cards from 1 to 20, in any order, repeats allowed. The
 * numbers stay far below 2^16, so the leak check below never mistakes one for a generator word.
 */
const deckArb = fc.array(fc.integer({ min: 1, max: 20 }), { minLength: 3, maxLength: 8 });

/**
 * Card IDs are unique, quoted tokens ("l12z", "s40z", "n7z"), so a leak check cannot match part of
 * another value. Each side gets the non-neutral cards the game needs (rulesetWith reads the
 * affiliation from the prefix); the other cards, of any affiliation, are split between the two hands
 * and the draw pile.
 */
const gameArb: fc.Arbitrary<Game> = fc
  .record({
    ids: fc.uniqueArray(fc.integer({ min: 0, max: 9999 }), {
      minLength: 2 * MOST_NEEDED,
      maxLength: 2 * MOST_NEEDED + 30,
    }),
    cutA: fc.nat(),
    cutB: fc.nat(),
    turns: fc.integer({ min: 1, max: MAX_TURNS }),
    playsPerTurn: fc.integer({ min: 1, max: MAX_PLAYS }),
    seed: fc.nat(),
    moves: fc.array(moveArb, { maxLength: 30 }),
    lioDeck: deckArb,
    saeDeck: deckArb,
    worldDeck: deckArb,
  })
  .map(({ ids, cutA, cutB, turns, playsPerTurn, seed, moves, lioDeck, saeDeck, worldDeck }) => {
    const needed = turns * (1 + playsPerTurn);
    const lio = ids.slice(0, needed).map((n) => `l${n}z`);
    const sae = ids.slice(needed, 2 * needed).map((n) => `s${n}z`);
    const rest = ids.slice(2 * needed).map((n) => `${PREFIXES[n % 3]}${n}z`);
    const a = cutA % (rest.length + 1);
    const b = a + (cutB % (rest.length - a + 1));
    const setup: Setup = {
      seedHash: seedHash(`seed-${seed}-x`),
      hands: { lio: [...lio, ...rest.slice(0, a)], sae: [...sae, ...rest.slice(a, b)] },
      deck: rest.slice(b),
      turns,
      playsPerTurn,
      // The smallest hand size: the dealt hands never drop below it, so this test's games draw no cards.
      handSize: 1 + playsPerTurn,
      contingency: { lio: lioDeck, sae: saeDeck, world: worldDeck },
    };
    return { setup, seed: `seed-${seed}-x`, moves };
  });

/** The answer a move gives to one of the open decisions: yes/no, or one of the legal cards. */
function answerFor(ruleset: Ruleset, s: GameState, move: Extract<Move, { kind: "answer" }>): Answer {
  const d = s.public.pending[move.which % s.public.pending.length]!;
  if (d.kind === "yesNo") return { decisionId: d.id, side: d.side, value: { kind: "yesNo", yes: move.yes } };
  const legal = legalAnswers(ruleset, s, d.side);
  return { decisionId: d.id, side: d.side, value: legal[move.pick % legal.length]! };
}

const halfAnswered = (s: GameState): boolean => SIDES.some((side) => s.private[side].picks.length > 0);

/** Every state the game passes through. A program starts only when none is running and no pair is half answered. */
function play(game: Game): GameState[] {
  const { hands, deck } = game.setup;
  const ruleset = rulesetWith([...hands.lio, ...hands.sae, ...deck]);
  const created = createGame(ruleset, game.setup, game.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  const states = [deepFreeze(created.value.state)];
  for (const move of game.moves) {
    const s = states[states.length - 1]!;
    if (s.public.status.kind === "over") break;
    if (move.kind === "program" && (s.public.stack.length > 0 || halfAnswered(s))) continue;
    const r =
      move.kind === "program"
        ? startProgram(ruleset, s, move.steps)
        : apply(
            ruleset,
            s,
            move.kind === "resign" ? { system: "resign", side: move.side } : answerFor(ruleset, s, move),
          );
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
  it("the random games really pause programs on the stack, and really leave pairs half answered", () => {
    const states = fc.sample(gameArb, { numRuns: 200, seed: 1 }).flatMap(play);
    expect(states.filter((s) => s.public.stack.length > 1).length).toBeGreaterThan(20);
    expect(states.filter(halfAnswered).length).toBeGreaterThan(20);
    expect(states.filter((s) => s.public.stack.length > 0 && halfAnswered(s)).length).toBeGreaterThan(5);
  });
  it("when a side makes its pick, the other side's and the spectator's views change only in meta.seq and public.pending", () => {
    const setAside = (v: PlayerView) => ({ ...v, meta: { ...v.meta, seq: 0 }, public: { ...v.public, pending: [] } });
    fc.assert(
      fc.property(gameArb, (game) => {
        const states = play(game);
        for (let i = 1; i < states.length; i++) {
          const [before, after] = [states[i - 1]!, states[i]!];
          const picker = SIDES.find((side) => after.private[side].picks.length > before.private[side].picks.length);
          if (!picker) continue;
          for (const viewer of [...SIDES.filter((x) => x !== picker), "spectator"] as Viewer[]) {
            expect(setAside(viewFor(after, viewer))).toEqual(setAside(viewFor(before, viewer)));
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
  it("each Contingency deck's full contents are the setup's sorted, its numbers left are its secret order sorted, and views show both but never the order", () => {
    const ascending = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);
    fc.assert(
      fc.property(gameArb, (game) => {
        for (const s of play(game)) {
          for (const side of DECKS) {
            const open = s.public.contingency[side];
            expect(open.cards).toEqual(ascending(game.setup.contingency[side]));
            expect(open.left).toEqual(ascending(s.secret.contingency[side]));
            expect(s.secret.contingency[side].length).toBeGreaterThanOrEqual(3);
            for (const viewer of [...SIDES, "spectator"] as const) {
              const seen = viewFor(s, viewer).public.contingency[side];
              expect(seen).toEqual(open);
              expect(Object.keys(seen).sort()).toEqual(["cards", "left"]);
            }
          }
        }
      }),
      { numRuns: 300 },
    );
  });
  it("the omniscient view's sides equal the state's private compartments and its public equals the state's public compartment", () => {
    fc.assert(
      fc.property(gameArb, (game) => {
        for (const s of play(game)) {
          const view = viewFor(s, "omniscient");
          expect(view.sides).toStrictEqual(s.private);
          expect(view.public).toStrictEqual(s.public);
          expect("secret" in view).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
  it("the leak check itself finds a hidden card when one is planted in a view", () => {
    const game = fc.sample(gameArb, { numRuns: 1, seed: 7 })[0]!;
    const s = play({ ...game, setup: { ...game.setup, deck: ["n1z"] } })[0]!;
    const planted = { ...s, public: { ...s.public, discard: ["n1z"] } };
    expect(leaks(planted, "spectator", game)).toContain('"n1z"');
  });
});
