// The Era 1 deck (1991 to 2001) as the engine and the screens use it: rules for the engine, names for the UI.
import type { CardDef, CardId, Ruleset } from "@terminal-dusk/engine";
import type { Card } from "./era1Files.ts";
import { ERA_1_CARDS } from "./era1Files.ts";

export { ERA_1_CARDS };
export type { Card };

/** The engine's view of a card: its rules only. The text (name, rules, history, art) stays in content. */
export const cardDef = (card: Card): CardDef => ({
  id: card.id,
  era: card.era,
  ops: card.ops,
  affiliation: card.affiliation,
  effect: card.effect,
});

/** The ruleset of the first deck: every Era 1 card. */
export const FIRST_DECK_RULESET: Ruleset = { id: "first-deck", cards: ERA_1_CARDS.map(cardDef) };

const NAMES = new Map<CardId, string>(ERA_1_CARDS.map((card) => [card.id, card.text.name]));

/** A card's name as shown to players. An unknown card shows its id, so a missing name is visible, not blank. */
export const cardName = (id: CardId): string => NAMES.get(id) ?? id;
