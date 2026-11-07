// TEST-ONLY FIXTURES, never game content: the fuzz cards with the steps real cards use that the base fuzz ruleset
// (cards.ts) leaves out: discardFromHand (random, chosen by the owner, chosen by the player), escalate up and down,
// addToNumber, and if on atLeast, atMost and equals. A separate ruleset, so the games in fixedGames.ts keep their
// decisions. Each step is announced by a marker, so the suite counts from the events alone what random play reached.
import type { GameEvent, Ruleset, Side, Step } from "@terminal-dusk/engine";
import { deepFreeze } from "./deepFreeze.ts";
import { ruleset } from "./play.ts";

/** Starts every announcement's label; then what the next step is. */
export const EXTRA = "extra:";

/** What the suite counts: each extra step kind, and each number test with the branch it took. */
export const EXTRA_KINDS = [
  "discard:random",
  "discard:owner",
  "discard:player",
  "escalate:up",
  "escalate:down",
  "addToNumber",
  "atLeast:then",
  "atLeast:else",
  "atMost:then",
  "atMost:else",
  "equals:then",
  "equals:else",
] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];

const announce = (kind: ExtraKind): Step => ({ op: "marker", label: `${EXTRA}${kind}` });
const TESTS = ["atLeast", "atMost", "equals"] as const;
const AMOUNTS = [2, -1, 1, -2];

/**
 * A contingency draw bound to "x", a non-zero whole number added to it, and an if on one of the number tests, each
 * branch announced. A LIO or SAE card draws from its own deck; a neutral card from its player's.
 */
function numberSteps(i: number, affiliation: Side | "neutral"): Step[] {
  const test = TESTS[Math.floor(i / 8) % 3]!;
  return [
    { op: "drawContingency", side: affiliation === "neutral" ? "player" : affiliation, bind: "x" },
    announce("addToNumber"),
    { op: "addToNumber", var: "x", amount: AMOUNTS[i % 4]! },
    {
      op: "if",
      cond: { op: test, var: "x", value: 1 + (i % 6) },
      // The step schema's if/then/else, never awaited, so not a thenable.
      then: [announce(`${test}:then`)], // NOSONAR (typescript:S7739)
      else: [announce(`${test}:else`)],
    },
  ];
}

/**
 * Fuzz card `i`'s extra steps, by its index: eight kinds of card take turns (the last adds nothing), and 8 is coprime
 * to 3, so LIO, SAE and neutral cards all have each kind.
 */
export function extraStepsOf(i: number, affiliation: Side | "neutral"): Step[] {
  const other: Side = i % 2 === 0 ? "lio" : "sae";
  switch (i % 8) {
    case 0:
      return [announce("escalate:up"), { op: "escalate", by: 1 + (i % 2) }];
    case 1:
      return [announce("escalate:down"), { op: "escalate", by: -1 }];
    case 2:
      return [announce("discard:random"), { op: "discardFromHand", side: other, count: 1 }];
    case 3:
      return [announce("discard:owner"), { op: "discardFromHand", side: other, count: 1, chosenBy: "owner" }];
    case 4:
      return [announce("discard:player"), { op: "discardFromHand", side: other, count: 1, chosenBy: "player" }];
    case 5:
    case 6:
      return numberSteps(i, affiliation);
    default:
      return [];
  }
}

/** The fuzz ruleset with each card's extra steps after its own effect. */
export const extraStepsRuleset: Ruleset = deepFreeze({
  ...ruleset,
  id: "fuzz-extra-steps-ruleset",
  cards: ruleset.cards.map((card, i) => ({ ...card, effect: [...card.effect, ...extraStepsOf(i, card.affiliation)] })),
});

/** The extra step an event announces, or null. */
export function announcedExtra(event: GameEvent): ExtraKind | null {
  if (event.kind !== "marker" || !event.label.startsWith(EXTRA)) return null;
  const kind = event.label.slice(EXTRA.length);
  return (EXTRA_KINDS as readonly string[]).includes(kind) ? (kind as ExtraKind) : null;
}
