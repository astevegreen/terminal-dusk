// Test helpers for lasting markers and `has` conditions (R4): a small ruleset whose cards set two lasting
// labels, and cards whose yes/no question exists only while a label is set. Seeded games built as newGame does.
import { apply, createGame, seedHash } from "@terminal-dusk/engine";
import { seededRandom } from "../random.ts";
import type { Answer, CardDef, GameEvent, Ruleset, Setup, Step } from "@terminal-dusk/engine";
import type { TestState } from "./testGames.ts";

/** The two lasting labels the marker cards set and the `has` cards test. */
export const MARKER_LABELS = ["alpha", "beta"] as const;

const AFFILIATIONS: readonly CardDef["affiliation"][] = ["lio", "sae", "neutral"];

/** `if has <label> { choose yesNo (both sides); marker "<label>-then" } else { marker "<label>-else" }`. */
function hasEffect(label: string): Step[] {
  return [
    {
      op: "if",
      cond: { op: "has", marker: label },
      then: [
        { op: "choose", who: "both", decision: { kind: "yesNo" }, bind: "a" },
        { op: "marker", label: `${label}-then` },
      ],
      else: [{ op: "marker", label: `${label}-else` }],
    },
  ];
}

/**
 * Card i's effect, by i % 6: 0 and 3 set "alpha" and "beta" with a lasting marker, 1 and 4 test them with
 * `has` (hasEffect), and 2 and 5 do nothing.
 */
function effectOf(i: number): Step[] {
  const label = MARKER_LABELS[i % 6 < 3 ? 0 : 1];
  if (i % 3 === 0) return [{ op: "marker", label, lasting: true }];
  if (i % 3 === 1) return hasEffect(label);
  return [];
}

/** Ninety cards: ops 0-4, affiliations in turn, and the marker and `has` effects of effectOf. */
export const markerRuleset: Ruleset = {
  id: "ai-marker-test",
  cards: Array.from({ length: 90 }, (_, i) => ({
    id: `m${i + 1}`,
    era: "test",
    ops: i % 5,
    affiliation: AFFILIATIONS[i % 3]!,
    effect: effectOf(i),
  })),
};

/**
 * A game of markerRuleset from `seed`, dealt as newGame deals: each side holds 2 x turns non-neutral cards and
 * 2 neutral ones, with 10 in the pile. Four turns by default, so a marker set early is tested in later turns.
 */
export function newMarkerGame(seed: number, turns = 4): TestState {
  const random = seededRandom(seed);
  const ids = markerRuleset.cards.map((card) => card.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  const sided = ids.filter((id) => markerRuleset.cards.find((c) => c.id === id)!.affiliation !== "neutral");
  const rest = ids.filter((id) => !sided.slice(0, 4 * turns).includes(id));
  const setup: Setup = {
    seedHash: seedHash(`ai-marker-${seed}`),
    hands: {
      lio: [...sided.slice(0, 2 * turns), rest[0]!, rest[1]!],
      sae: [...sided.slice(2 * turns, 4 * turns), rest[2]!, rest[3]!],
    },
    deck: rest.slice(4, 14),
    turns,
    playsPerTurn: 1,
    handSize: 2,
    contingency: { lio: [1, 2, 3, 3, 5], sae: [2, 4, 4, 6] },
  };
  const made = createGame(markerRuleset, setup, `ai-marker-${seed}`);
  if (!made.ok) throw new Error(`createGame refused: ${made.error.code}`);
  return made.value.state;
}

/** Applies `answer` to a markerRuleset game, failing the test if the engine refuses it; returns its events too. */
export function applyMarkerAnswer(state: TestState, answer: Answer): { state: TestState; events: GameEvent[] } {
  const r = apply(markerRuleset, state, answer);
  if (!r.ok) throw new Error(`apply refused ${JSON.stringify(answer)}: ${r.error.code}`);
  return r.value;
}
