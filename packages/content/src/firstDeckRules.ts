// The ruleset and card names of the first deck: Era 1, Era 2, Era 3 and the optional future cards. Only Era 1 is dealt
// into opening hands; the later eras enter as the scenario's `eras` entries, so the ruleset must know their cards.
import type { CardId, Ruleset } from "@terminal-dusk/engine";
import { ERA_1_CARDS, cardDef } from "./era1.ts";
import { ERA_2_CARDS } from "./era2Files.ts";
import { ERA_3_CARDS } from "./era3Files.ts";
import { FUTURE_CARDS } from "./futureFiles.ts";

/** Every card of the first deck, in era order (Era 1, 2, 3, then the future cards). */
export const FIRST_DECK_CARDS = [...ERA_1_CARDS, ...ERA_2_CARDS, ...ERA_3_CARDS, ...FUTURE_CARDS];

/** The ruleset of the first deck: every Era 1, Era 2, Era 3 and future card. */
export const FIRST_DECK_RULESET: Ruleset = { id: "first-deck", cards: FIRST_DECK_CARDS.map(cardDef) };

const NAMES = new Map<CardId, string>(FIRST_DECK_CARDS.map((card) => [card.id, card.text.name]));

/** A card's name as shown to players. An unknown card shows its id, so a missing name is visible, not blank. */
export const cardName = (id: CardId): string => NAMES.get(id) ?? id;
