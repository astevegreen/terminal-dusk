// Unified command, played for on purpose (#628; docs/design/sides.md, "SAE: Unified command"). The bonus once set up is
// counted by answerOps (easy.ts); this is what setting it up is worth, for Medium's score (and so Hard's search).
import type { AnswerValue, PlayerView, Ruleset, Side } from "@terminal-dusk/engine";
import { namedCard } from "./easy.ts";

/**
 * The bonus `answer` sets up for `side`'s next play for points this turn: its Unified command's bonus when the answer
 * plays the side's own card for its event, the command is neither ready nor used this turn, the side has another
 * normal play after this one (plays alternate, so its next is two on; Hypersonics' extra play is not counted), and
 * its hand holds a card besides this one. Otherwise 0, an opening pick included.
 */
export function primeBonus(ruleset: Ruleset, view: PlayerView, side: Side, answer: AnswerValue): number {
  if (answer.kind !== "playCardAs" || answer.as !== "event") return 0;
  if (namedCard(ruleset, answer)?.affiliation !== side) return 0;
  const pub = view.public;
  const command = pub.abilities?.[side];
  if (command?.id !== "unifiedCommand" || command.ready || command.used > 0) return 0;
  if (pub.playsMade + 2 >= 2 * pub.playsPerTurn) return 0;
  return (view.mine?.hand.length ?? 0) >= 2 ? command.bonus : 0;
}
