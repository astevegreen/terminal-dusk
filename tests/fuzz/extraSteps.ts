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
function numberSteps(i: number, affiliation: Side | "neutral", setting: number): Step[] {
  const test = TESTS[Math.floor(i / 8) % 3]!;
  return [
    { op: "drawContingency", side: affiliation === "neutral" ? "player" : affiliation, bind: "x" },
    announce("addToNumber"),
    { op: "addToNumber", var: "x", amount: AMOUNTS[setting % 4]! },
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
 * to 3, so LIO, SAE and neutral cards all have each kind. `setting` picks a kind's settings (whose hand, by how much).
 */
function extraStepsOf(i: number, affiliation: Side | "neutral", setting: number): Step[] {
  const other: Side = setting % 2 === 0 ? "lio" : "sae";
  switch (i % 8) {
    case 0:
      return [announce("escalate:up"), { op: "escalate", by: 1 + (setting % 2) }];
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
      return numberSteps(i, affiliation, setting);
    default:
      return [];
  }
}

/** The fuzz ruleset with each card's extra steps after its own effect, their settings picked by `setting(i)`. */
function withExtraSteps(id: string, setting: (i: number) => number): Ruleset {
  return deepFreeze({
    ...ruleset,
    id,
    cards: ruleset.cards.map((card, i) => ({
      ...card,
      effect: [...card.effect, ...extraStepsOf(i, card.affiliation, setting(i))],
    })),
  });
}

/**
 * The ruleset random games play. A kind's settings change with the round of eight, not with `i`'s parity, which
 * each kind's place in the eight fixes: so both sides lose a card to each discard, and every amount is added.
 */
export const extraStepsRuleset: Ruleset = withExtraSteps("fuzz-extra-steps-ruleset-2", (i) => Math.floor(i / 8));

/**
 * The first ruleset, its settings picked by `i`'s parity, so each discard always took the same side's card. Kept,
 * never played at random, so the fixed games recorded with it (fixedGames.ts) replay to the same end.
 */
export const firstExtraStepsRuleset: Ruleset = withExtraSteps("fuzz-extra-steps-ruleset", (i) => i);

/** The extra step an event announces, or null. */
export function announcedExtra(event: GameEvent): ExtraKind | null {
  if (event.kind !== "marker" || !event.label.startsWith(EXTRA)) return null;
  const kind = event.label.slice(EXTRA.length);
  return (EXTRA_KINDS as readonly string[]).includes(kind) ? (kind as ExtraKind) : null;
}
