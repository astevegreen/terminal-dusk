// Which cards a side has not seen yet, and what a card does to Escalation. Reads only the view and the ruleset.
import type { CardDef, PlayerView, Ruleset, Step } from "@terminal-dusk/engine";
import { seenCards } from "./guess.ts";

/** The cards the viewer has not seen: not in its hand, in play, discarded, removed or among its own picks. */
export function unseenCards(ruleset: Ruleset, view: PlayerView): CardDef[] {
  const seen = seenCards(view);
  return ruleset.cards.filter((card) => !seen.has(card.id));
}

/** How far the steps move Escalation in the worst case: up (a raise) and down (a lower), both 0 or more. */
function escalationOfSteps(steps: readonly Step[]): { up: number; down: number } {
  let up = 0;
  let down = 0;
  for (const step of steps) {
    const inner =
      step.op === "if"
        ? bigger(escalationOfSteps(step.then), escalationOfSteps(step.else ?? []))
        : step.op === "forEach" || step.op === "trigger"
          ? escalationOfSteps(step.do)
          : { up: 0, down: 0 };
    if (step.op === "escalate") {
      if (step.by > 0) up += step.by;
      else down -= step.by;
    }
    up += inner.up;
    down += inner.down;
  }
  return { up, down };
}

const bigger = (a: { up: number; down: number }, b: { up: number; down: number }) => ({
  up: Math.max(a.up, b.up),
  down: Math.min(a.down, b.down),
});

/** What the card's event adds to Escalation at most (`up`) and takes off at least (`down`). */
export function escalationEffect(card: CardDef): { up: number; down: number } {
  return escalationOfSteps(card.effect);
}
