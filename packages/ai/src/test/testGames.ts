// Test helpers: a small ruleset and seeded games, so the AI tests can make real views with the engine.
import { apply, createGame, seedHash } from "@terminal-dusk/engine";
import { seededRandom } from "../random.ts";
import type { Answer, CardDef, GameEvent, Ruleset, Setup, Step } from "@terminal-dusk/engine";

/** The full game record the engine makes, named by what createGame returns. */
export type TestState = Extract<ReturnType<typeof createGame>, { ok: true }>["value"]["state"];

const AFFILIATIONS: readonly CardDef["affiliation"][] = ["lio", "sae", "neutral"];

/** Ninety cards with ids `<prefix>1` to `<prefix>90`: ops 0-4, affiliations in turn, and card i's effect. */
export function ninetyCards(id: string, prefix: string, effectOf: (i: number) => Step[]): Ruleset {
  return {
    id,
    cards: Array.from({ length: 90 }, (_, i) => ({
      id: `${prefix}${i + 1}`,
      era: "test",
      ops: i % 5,
      affiliation: AFFILIATIONS[i % 3]!,
      effect: effectOf(i),
    })),
  };
}

/** Ninety cards: ops 0-4, affiliations in turn, and every fourth asks LIO a yes/no question. */
export const ruleset: Ruleset = ninetyCards("ai-test", "c", (i) =>
  i % 4 === 3 ? [{ op: "choose", who: "lio", decision: { kind: "yesNo" }, bind: "a" }] : [],
);

/**
 * A game of `rules` from `seed`, named `<name>-<seed>`: each side holds 2 x turns non-neutral cards and 2
 * neutral ones, with 10 in the pile. `extra` adds setup fields, such as a map.
 */
export function dealGame(
  rules: Ruleset,
  name: string,
  seed: number,
  turns: number,
  extra: Pick<Setup, "map"> = {},
): TestState {
  const random = seededRandom(seed);
  const ids = rules.cards.map((card) => card.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  const sided = ids.filter((id) => rules.cards.find((c) => c.id === id)!.affiliation !== "neutral");
  const rest = ids.filter((id) => !sided.slice(0, 4 * turns).includes(id));
  const setup: Setup = {
    seedHash: seedHash(`${name}-${seed}`),
    hands: {
      lio: [...sided.slice(0, 2 * turns), rest[0]!, rest[1]!],
      sae: [...sided.slice(2 * turns, 4 * turns), rest[2]!, rest[3]!],
    },
    deck: rest.slice(4, 14),
    turns,
    playsPerTurn: 1,
    // The smallest hand size: the dealt hands never drop below it, so these games draw no cards.
    handSize: 2,
    contingency: { lio: [1, 2, 3, 3, 5], sae: [2, 4, 4, 6], world: [1, 1, 7, 8] },
    ...extra,
  };
  const made = createGame(rules, setup, `${name}-${seed}`);
  if (!made.ok) throw new Error(`createGame refused: ${made.error.code}`);
  return made.value.state;
}

/** A game of `ruleset` from `seed`, dealt by dealGame. */
export function newGame(seed: number, turns = 2): TestState {
  return dealGame(ruleset, "ai", seed, turns);
}

/** Applies `answer` to a game of `rules`, failing the test if the engine refuses it; returns its events too. */
export function applyTo(rules: Ruleset, state: TestState, answer: Answer): { state: TestState; events: GameEvent[] } {
  const r = apply(rules, state, answer);
  if (!r.ok) throw new Error(`apply refused ${JSON.stringify(answer)}: ${r.error.code}`);
  return r.value;
}

/** Applies `answer` to a game of `ruleset`, failing the test if the engine refuses it. */
export function applyAnswer(state: TestState, answer: Answer): TestState {
  return applyTo(ruleset, state, answer).state;
}
