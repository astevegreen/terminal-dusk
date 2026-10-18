// Test helpers: a small ruleset and seeded games, so the AI tests can make real views with the engine.
import { apply, createGame, seedHash, SIDES } from "@terminal-dusk/engine";
import type { Answer, CardDef, Ruleset, Setup } from "@terminal-dusk/engine";

/** The full game record the engine makes, named by what createGame returns. */
export type TestState = Extract<ReturnType<typeof createGame>, { ok: true }>["value"]["state"];

const AFFILIATIONS: readonly CardDef["affiliation"][] = ["lio", "sae", "neutral"];

/** Ninety cards: ops 0-4, affiliations in turn, and every fourth asks LIO a yes/no question. */
export const ruleset: Ruleset = {
  id: "ai-test",
  cards: Array.from({ length: 90 }, (_, i) => ({
    id: `c${i + 1}`,
    era: "test",
    ops: i % 5,
    affiliation: AFFILIATIONS[i % 3]!,
    effect:
      i % 4 === 3
        ? [{ op: "choose" as const, who: "lio" as const, decision: { kind: "yesNo" as const }, bind: "a" }]
        : [],
  })),
};

/** A small seeded generator (mulberry32) giving numbers from 0 up to, not including, 1. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A game from `seed`: each side holds 2 x turns non-neutral cards and 2 neutral ones, with 10 in the pile. */
export function newGame(seed: number, turns = 2): TestState {
  const random = seededRandom(seed);
  const ids = ruleset.cards.map((card) => card.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  const sided = ids.filter((id) => ruleset.cards.find((c) => c.id === id)!.affiliation !== "neutral");
  const rest = ids.filter((id) => !sided.slice(0, 4 * turns).includes(id));
  const setup: Setup = {
    seedHash: seedHash(`ai-${seed}`),
    hands: {
      lio: [...sided.slice(0, 2 * turns), rest[0]!, rest[1]!],
      sae: [...sided.slice(2 * turns, 4 * turns), rest[2]!, rest[3]!],
    },
    deck: rest.slice(4, 14),
    turns,
    playsPerTurn: 1,
    contingency: { lio: [1, 2, 3, 3, 5], sae: [2, 4, 4, 6] },
  };
  const made = createGame(ruleset, setup, `ai-${seed}`);
  if (!made.ok) throw new Error(`createGame refused: ${made.error.code}`);
  return made.value.state;
}

/** Applies `answer`, failing the test if the engine refuses it. */
export function applyAnswer(state: TestState, answer: Answer): TestState {
  const r = apply(ruleset, state, answer);
  if (!r.ok) throw new Error(`apply refused ${JSON.stringify(answer)}: ${r.error.code}`);
  return r.value.state;
}

/** The first side with something pending, in SIDES order. */
export function firstWaiting(state: TestState): (typeof SIDES)[number] | null {
  return SIDES.find((side) => state.public.pending.some((d) => d.side === side)) ?? null;
}
