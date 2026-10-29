// The Medium tier's tech race odds (docs/design/tech-race.md, "Making an attempt"): an attempt draws from the side's
// own Contingency deck, whose numbers left are public. So rather than trust one guessed order, Medium tries each
// number on top in turn and weighs it by its share of the deck. Reads only the view and the guess it is given.
import type { HiddenPart, PlayerView, Side } from "@terminal-dusk/engine";

/** One way the attempt's draw can go: the guess with one number on top of the side's deck, and its chance. */
export type DrawVariant = { hidden: HiddenPart; weight: number };

/**
 * One variant of `hidden` for each different number left in `side`'s own Contingency deck, in ascending order: that
 * number first in the deck's order (the engine draws the first), the rest after it, weighted by how many of it are
 * left over the deck's size. The weights add up to 1. An empty deck gives `hidden` alone.
 */
export function drawVariants(view: PlayerView, hidden: HiddenPart, side: Side): DrawVariant[] {
  const left = view.public.contingency[side].left;
  if (left.length === 0) return [{ hidden, weight: 1 }];
  const numbers = [...new Set(left)].sort((a, b) => a - b);
  return numbers.map((top) => {
    const rest = [...left];
    rest.splice(rest.indexOf(top), 1);
    const contingency = { ...hidden.secret.contingency, [side]: [top, ...rest] };
    return {
      hidden: { ...hidden, secret: { ...hidden.secret, contingency } },
      weight: left.filter((n) => n === top).length / left.length,
    };
  });
}
