// The Era 1 deck (1991 to 2001) as the engine and the screens use it: rules for the engine, names for the UI.
import type { CardDef } from "@terminal-dusk/engine";
import type { Card } from "./era1Files.ts";
import { ERA_1_CARDS } from "./era1Files.ts";

export { ERA_1_CARDS };
export type { Card };

/**
 * The engine's view of a card: its rules only, with its flags when it has any (a once-only card's
 * removeAfterEvent). The text (name, rules, history, art) stays in content.
 */
export const cardDef = (card: Card): CardDef => ({
  id: card.id,
  era: card.era,
  ops: card.ops,
  affiliation: card.affiliation,
  effect: card.effect,
  ...(card.flags === undefined ? {} : { flags: card.flags }),
});
