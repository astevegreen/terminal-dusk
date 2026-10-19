// The ruleset and card names of the first deck: Era 1 and Era 2. Only Era 1 is dealt into opening hands; Era 2 enters
// later as the scenario's `eras` entry, so the ruleset must know its cards from the start.
import type { CardId, Ruleset } from "@terminal-dusk/engine";
import { ERA_1_CARDS, cardDef } from "./era1.ts";
import { ERA_2_CARDS } from "./era2Files.ts";

/** Every card of the first deck, in era order. */
export const FIRST_DECK_CARDS = [...ERA_1_CARDS, ...ERA_2_CARDS];

/** The ruleset of the first deck: every Era 1 and Era 2 card. */
export const FIRST_DECK_RULESET: Ruleset = { id: "first-deck", cards: FIRST_DECK_CARDS.map(cardDef) };

const NAMES = new Map<CardId, string>(FIRST_DECK_CARDS.map((card) => [card.id, card.text.name]));

/** A card's name as shown to players. An unknown card shows its id, so a missing name is visible, not blank. */
export const cardName = (id: CardId): string => NAMES.get(id) ?? id;
