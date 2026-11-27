// The Medium tier's tech race odds (docs/design/tech-race.md, "Making an attempt"): an attempt draws from the side's
// own Contingency deck, whose numbers left are public. So rather than trust one guessed order, Medium tries each
// number on top in turn and weighs it by its share of the deck. LIO's Resilient institutions (docs/design/sides.md)
// sets a first 1 aside and draws again, so a 1 on top is weighed by the draw that replaces it (#675). Reads only the
// view and the guess it is given.
import type { HiddenPart, PlayerView, Side } from "@terminal-dusk/engine";

/**
 * One way the attempt's draw can go: the guess with one number on top of the side's deck, and its chance. `view`,
 * when present, replaces the player's view for this variant: the board just after a redrawn 1 was set aside.
 */
export type DrawVariant = { hidden: HiddenPart; weight: number; view?: PlayerView };

/** A deck that has drawn down to this many cards is rebuilt from its full contents (the engine's drawPlain). */
const RESHUFFLE_AT = 2;

/** The number Resilient institutions sets aside and draws again for. */
const REDRAWN = 1;

/** `left`, without one instance of `n`. */
function without(left: readonly number[], n: number): number[] {
  const rest = [...left];
  rest.splice(rest.indexOf(n), 1);
  return rest;
}

/** One variant per different number in `left`, ascending: that number on top of `side`'s deck, weighted by share. */
function topVariants(left: readonly number[], hidden: HiddenPart, side: Side, scale: number): DrawVariant[] {
  const numbers = [...new Set(left)].sort((a, b) => a - b);
  return numbers.map((top) => {
    const contingency = { ...hidden.secret.contingency, [side]: [top, ...without(left, top)] };
    return {
      hidden: { ...hidden, secret: { ...hidden.secret, contingency } },
      weight: (scale * left.filter((n) => n === top).length) / left.length,
    };
  });
}

/** True when `side`'s Resilient institutions has a use left this turn in `view`. */
function canRedraw(view: PlayerView, side: Side): boolean {
  const ability = view.public.abilities?.[side];
  return ability?.id === "resilientInstitutions" && ability.used < ability.perTurn;
}

/** `view` with `side`'s Resilient institutions used up for the turn, so a second draw stands, a 1 included. */
function usedUp(view: PlayerView, side: Side): NonNullable<PlayerView["public"]["abilities"]> {
  const abilities = view.public.abilities!;
  const ability = abilities[side];
  if (ability.id !== "resilientInstitutions") return abilities;
  return { ...abilities, [side]: { ...ability, used: ability.perTurn } };
}

/**
 * The variants for a first draw of 1 that Resilient institutions redraws, with chance `weight`: the view just after
 * the 1 was set aside (Resilient institutions used up, so the second draw stands, a 1 included; the deck down by the
 * 1, or rebuilt when that left two cards), and each number the second draw can show on top of it.
 */
function redrawVariants(view: PlayerView, hidden: HiddenPart, side: Side, weight: number): DrawVariant[] {
  const open = view.public.contingency[side];
  const rest = without(open.left, REDRAWN);
  const left = rest.length === RESHUFFLE_AT ? [...open.cards].sort((a, b) => a - b) : rest;
  const after: PlayerView = {
    ...view,
    public: {
      ...view.public,
      contingency: { ...view.public.contingency, [side]: { ...open, left } },
      abilities: usedUp(view, side),
    },
  };
  return topVariants(left, hidden, side, weight).map((v) => ({ ...v, view: after }));
}

/**
 * The ways `side`'s attempt can draw, in ascending order of the first number drawn: each different number left in its
 * own Contingency deck first in the deck's order (the engine draws the first), the rest after it, weighted by how many
 * of it are left over the deck's size; a 1 that Resilient institutions would redraw is split into the draws that
 * replace it. The weights add up to 1. An empty deck gives `hidden` alone.
 */
export function drawVariants(view: PlayerView, hidden: HiddenPart, side: Side): DrawVariant[] {
  const left = view.public.contingency[side].left;
  if (left.length === 0) return [{ hidden, weight: 1 }];
  return topVariants(left, hidden, side, 1).flatMap((v) =>
    v.hidden.secret.contingency[side][0] === REDRAWN && canRedraw(view, side)
      ? redrawVariants(view, hidden, side, v.weight)
      : [v],
  );
}
