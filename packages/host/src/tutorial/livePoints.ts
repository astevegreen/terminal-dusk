// The live numbers a tutorial line quotes (#699; docs/design/tutorial.md, "Numbers and places come from the live
// game"), worked out from the learner's view and the ruleset's card data, never GameState (hard rule 2). The points
// rule itself stays in the engine (modifiedOps, pointsBonus, techRaceCost); this file only reads what a card's event
// would add to it. Anything it cannot work out throws, so a line never shows a wrong or blank number.
import { modifiedOps, pointsBonus, techRaceCost } from "@terminal-dusk/engine";
import type { ActiveModifier, CardDef, PlayerView, Ruleset, Side, Step } from "@terminal-dusk/engine";

type Mod = Pick<ActiveModifier, "mod">;
type Spend = { side: Side; amount: number; before: Mod[] };
/** What a card's event does to points, in order: the modifiers it makes, and each spend with the modifiers before it. */
type Walked = { modifiers: Mod[]; spends: Spend[] };

const fail = (why: string): never => {
  throw new Error(`Tutorial line: ${why}`);
};

/** The card `id` in `ruleset`, or a throw. */
export function cardIn(ruleset: Ruleset, id: string): CardDef {
  return ruleset.cards.find((c) => c.id === id) ?? fail(`the ruleset has no card ${id}.`);
}

/**
 * Walks `card`'s event as if `playedBy` played it, from the public `view`: its modifiers and spends, in order. Only the
 * steps Era 1's coaching needs are known (marker, modifier, spendPoints, escalate, and if on has or playedBy); any
 * other step throws rather than guessing.
 */
function walk(card: CardDef, playedBy: Side, view: PlayerView): Walked {
  const markers = new Set(view.public.markers);
  const out: Walked = { modifiers: [], spends: [] };
  const run = (steps: readonly Step[]): void => {
    for (const step of steps) {
      if (step.op === "marker") {
        if (step.lasting === true) markers.add(step.label);
      } else if (step.op === "modifier") {
        out.modifiers.push({ mod: step.mod });
      } else if (step.op === "spendPoints") {
        out.spends.push({ side: step.side, amount: step.amount, before: [...out.modifiers] });
      } else if (step.op === "if") {
        const c = step.cond;
        const holds =
          c.op === "has"
            ? markers.has(c.marker)
            : c.op === "playedBy"
              ? c.side === playedBy
              : fail(`${card.id}'s event tests ${c.op}, which a line can't read.`);
        run(holds ? step.then : (step.else ?? []));
      } else if (step.op !== "escalate") {
        fail(`${card.id}'s event has a ${step.op} step, which a line can't read.`);
      }
    }
  };
  run(card.effect);
  return out;
}

/** The points `side` would have now from `card` played for its points, with `extra` modifiers after those in force. */
function points(view: PlayerView, card: CardDef, side: Side, extra: readonly Mod[] = []): number {
  const mods = [...view.public.modifiers, ...extra];
  return modifiedOps(card.ops, mods, side) + pointsBonus(view.public, side);
}

/** `card`'s points for `side` now. With the card's event spent after (chapter 3's "After"), the same. */
export const cardPoints = (view: PlayerView, card: CardDef, side: Side): number => points(view, card, side);

/** `card`'s points for `side` with its own event run first (chapter 3's "Before"). */
export const pointsBefore = (view: PlayerView, card: CardDef, side: Side): number =>
  points(view, card, side, walk(card, side, view).modifiers);

/** What the modifiers `card` made, in force now, take off `side`'s spends (chapter 3's Rwandan Genocide term). */
export function modifierTakesOff(view: PlayerView, card: CardDef, side: Side): number {
  const mine = view.public.modifiers.filter(
    (m) => m.source === card.id && m.mod.hook === "opsValue" && (m.mod.side === side || m.mod.side === "both"),
  );
  if (mine.length === 0) fail(`no modifier of ${card.id} is in force for ${side}.`);
  return mine.reduce((sum, m) => sum - m.mod.add, 0);
}

/** The points `card`'s event gives its side to spend when `playedBy` plays it (chapter 6's "would give SAE 2"). */
export function eventPoints(view: PlayerView, card: CardDef, playedBy: Side): number {
  const { spends } = walk(card, playedBy, view);
  if (spends.length !== 1) fail(`${card.id}'s event spends points ${spends.length} times, not once.`);
  const spend = spends[0]!;
  return modifiedOps(spend.amount, [...view.public.modifiers, ...spend.before], spend.side);
}

/** The stability chapter 4's line names in its own words, "a stability-2 country": fixed text, not read from the map. */
const LINE_STABILITY = 2;

/**
 * How far below the draw an intervention's result falls in a stability-2 country with `card`'s points now: result =
 * draw + points - 2 x stability, so 4 - points (chapter 4). Above 0 when the points are below 4.
 */
export function belowDraw(view: PlayerView, card: CardDef, side: Side): number {
  return 2 * LINE_STABILITY - cardPoints(view, card, side);
}

/** The cost of the tech race step `side` would try now (chapter 6). */
export function raceCost(view: PlayerView, side: Side): number {
  return techRaceCost(view.public, side) ?? fail(`${side} has no tech race step to try.`);
}

/** The names of the countries where `side` has influence, in map order. */
export function influenceIn(view: PlayerView, side: Side): string[] {
  const map = view.public.map ?? fail("the game has no map.");
  const held = new Set((view.public.influence ?? []).filter((e) => e[side] > 0).map((e) => e.country));
  return map.countries.filter((c) => held.has(c.id)).map((c) => c.name);
}

/** The names of the countries next to `side`'s home box, in the map's homeBox order. */
export function homeNeighbours(view: PlayerView, side: Side): string[] {
  const map = view.public.map ?? fail("the game has no map.");
  const nameOf = (id: string) => map.countries.find((c) => c.id === id)?.name ?? fail(`the map has no country ${id}.`);
  return map.homeBox[side].map(nameOf);
}

export { fail };
