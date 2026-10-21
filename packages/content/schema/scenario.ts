// The scenario schema: what one scenario file in packages/content/scenarios/ must hold (docs/architecture.md,
// section 4). Part 1 covers the length of the game, plays per turn, the hand size, later eras and Contingency
// decks.
// It refuses what the engine's createGame would refuse in those fields; scenario.types.test.ts checks it
// against the engine's Setup.
import * as z from "zod";

const name = z.string().min(1);

/** A later era: its name, the turn it enters on, and the cards it shuffles into the draw pile. */
const eraEntry = z.strictObject({ era: name, turn: z.number(), cards: z.array(name).min(1) });

/** One side's Contingency deck: at least 3 cards, each a whole number, 1 or more. */
const deck = z.array(z.int().min(1)).min(3);

/** Checks the eras against the scenario's length: each turn in range and unused, each card listed once. */
function checkEras(
  scenario: { turns: number; eras?: readonly { turn: number; cards: readonly string[] }[] | undefined },
  ctx: z.RefinementCtx,
): void {
  const turnsUsed = new Set<number>();
  const cardsUsed = new Set<string>();
  (scenario.eras ?? []).forEach((entry, i) => {
    if (!Number.isInteger(entry.turn) || entry.turn < 2 || entry.turn > scenario.turns) {
      ctx.addIssue({
        code: "custom",
        path: ["eras", i, "turn"],
        message: `An era must enter on a whole-number turn from 2 to ${scenario.turns}.`,
      });
    } else if (turnsUsed.has(entry.turn)) {
      ctx.addIssue({ code: "custom", path: ["eras", i, "turn"], message: `Two eras enter on turn ${entry.turn}.` });
    } else {
      turnsUsed.add(entry.turn);
    }
    entry.cards.forEach((card, j) => {
      if (cardsUsed.has(card)) {
        ctx.addIssue({ code: "custom", path: ["eras", i, "cards", j], message: `Card ${card} is listed twice.` });
      }
      cardsUsed.add(card);
    });
  });
}

/**
 * Checks the hand size against plays per turn: a side needs an opening card and all its plays each turn
 * (docs/design/core-loop.md, "For the engine"). That the first era holds two hands is checked by createGame.
 */
function checkHandSize(scenario: { playsPerTurn: number; handSize: number }, ctx: z.RefinementCtx): void {
  // A hand size below 1 is already refused by its own check; one problem gets one message.
  if (scenario.handSize >= 1 && scenario.handSize < 1 + scenario.playsPerTurn) {
    ctx.addIssue({
      code: "custom",
      path: ["handSize"],
      message: `The hand size must be at least 1 + plays per turn, ${1 + scenario.playsPerTurn}.`,
    });
  }
}

/** A scenario file. No other fields are allowed; a field written as undefined is refused, not read as left out. */
export const scenarioSchema = z
  .strictObject({
    id: name,
    name,
    turns: z.int().min(1),
    playsPerTurn: z.int().min(1),
    handSize: z.int().min(1),
    eras: z.array(eraEntry).exactOptional(),
    contingency: z.strictObject({ lio: deck.exactOptional(), sae: deck.exactOptional() }).exactOptional(),
  })
  .superRefine(checkEras)
  .superRefine(checkHandSize);

/** A scenario as it reads from its file. */
export type Scenario = z.output<typeof scenarioSchema>;
