// The invariant checks the fuzz suite runs on every state (docs/architecture.md, "Guardrails", "Fuzz suite").
// Each check throws an Error saying what is wrong; play.ts adds the game's seed and answers to it.
import {
  eventsFor,
  hiddenPart,
  legalAnswers,
  pendingFor,
  reconstruct,
  seedHash,
  SIDES,
  viewFor,
} from "@terminal-dusk/engine";
import type { CardId, GameEvent, GameState, PlayerView, Ruleset, Seed, Setup, Viewer } from "@terminal-dusk/engine";
import { deepFreeze } from "./deepFreeze.ts";

export const VIEWERS: readonly Viewer[] = ["lio", "sae", "spectator"];

/** What a viewer must never be sent. `rng` is the generator state, a list of four numbers. */
export type Secrets = { seed: Seed; rng: unknown; hidden: readonly CardId[] };

/** Runs one engine call. If it throws, the failure names the call instead of crashing the suite. */
export function attempt<T>(call: string, run: () => T): T {
  try {
    return run();
  } catch (err) {
    throw new Error(`${call} threw: ${String(err)}`, { cause: err });
  }
}

/**
 * All the checks for one step: invariants 1, 3, 4 and 5, and the Contingency decks. `events` are the ones
 * that step produced.
 */
export function checkStep(
  ruleset: Ruleset,
  setup: Setup,
  state: GameState,
  events: readonly GameEvent[],
  seed: Seed,
): void {
  checkLive(ruleset, state);
  checkCards(setup, state);
  checkContingency(setup, state);
  checkNoLeaks(state, events, seed);
  checkSeedHash(state, seed);
  checkRebuilds(state);
}

/** Invariant 1: while the game is active, some side has a pending decision with at least one legal answer. */
export function checkLive(ruleset: Ruleset, state: GameState): void {
  if (state.public.status.kind !== "active") return;
  const canAnswer = SIDES.some(
    (side) =>
      attempt(`pendingFor('${side}')`, () => pendingFor(state, side)) !== null &&
      attempt(`legalAnswers('${side}')`, () => legalAnswers(ruleset, state, side)).length > 0,
  );
  if (!canAnswer) throw new Error("the game is active, but no side has a decision with a legal answer");
}

/**
 * The cards that have entered the game by `turn`: both starting hands and the draw pile, plus the cards
 * of each era whose turn has come. Worked out from the setup alone, never from the engine's state.
 */
export function enteredCards(setup: Setup, turn: number): CardId[] {
  const eras = (setup.eras ?? []).filter((entry) => entry.turn <= turn).flatMap((entry) => entry.cards);
  return [...setup.hands.lio, ...setup.hands.sae, ...setup.deck, ...eras];
}

/**
 * Invariant 3: the cards in the draw pile, both hands, the discard pile and `inPlay` are exactly the cards
 * that have entered the game, each exactly once. Compared as sorted lists of IDs, so a card missing and
 * another card twice is caught even though the count is right.
 */
export function checkCards(setup: Setup, state: GameState): void {
  const hands = [...state.private.lio.hand, ...state.private.sae.hand];
  const found = [...state.secret.deck, ...hands, ...state.public.discard, ...state.public.inPlay].sort();
  const expected = enteredCards(setup, state.public.turn).sort();
  if (JSON.stringify(found) === JSON.stringify(expected)) return;
  const missing = expected.filter((card) => !found.includes(card));
  const extra = found.filter((card, i) => !expected.includes(card) || found.indexOf(card) !== i);
  throw new Error(
    `the cards in play are not the cards that have entered the game: missing ${JSON.stringify(missing)}, ` +
      `extra or twice ${JSON.stringify(extra)}`,
  );
}

/** Numbers sorted ascending, as numbers (plain `.sort()` would put 10 before 2). */
const ascending = (numbers: readonly number[]): number[] => [...numbers].sort((a, b) => a - b);
const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Whether each number in `part` is in `whole` at least as many times as in `part`. */
export function isSubMultiset(part: readonly number[], whole: readonly number[]): boolean {
  const rest = [...whole];
  return part.every((n) => {
    const i = rest.indexOf(n);
    if (i >= 0) rest.splice(i, 1);
    return i >= 0;
  });
}

/**
 * The Contingency decks (#64), for each side: the full contents are the setup's deck, sorted; the numbers
 * left are the secret order, sorted, and a sub-multiset of the full contents; the deck holds at least 2
 * cards. The public lists are compared as they are, never re-sorted here, so a list in draw order is caught.
 */
export function checkContingency(setup: Setup, state: GameState): void {
  for (const side of SIDES) {
    const { cards, left } = state.public.contingency[side];
    const order = state.secret.contingency[side];
    const deck = `${side}'s Contingency deck`;
    if (!sameJson(cards, ascending(setup.contingency[side]))) {
      throw new Error(`${deck}: the full contents ${JSON.stringify(cards)} are not the setup's deck, sorted`);
    }
    if (!sameJson(left, ascending(order))) {
      throw new Error(`${deck}: the numbers left ${JSON.stringify(left)} are not the secret order, sorted`);
    }
    if (!isSubMultiset(left, cards)) {
      throw new Error(`${deck}: the numbers left ${JSON.stringify(left)} are not all in ${JSON.stringify(cards)}`);
    }
    if (order.length < 2) throw new Error(`${deck} holds ${order.length} cards; it must always hold 2 or more`);
  }
}

/** The path to every field in `value` whose name mentions contingency, in any case. */
function contingencyFields(value: unknown, path: string): string[] {
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, inner]) => [
    ...(/contingency/i.test(key) ? [`${path}.${key}`] : []),
    ...contingencyFields(inner, `${path}.${key}`),
  ]);
}

/**
 * What `view` gives away about the Contingency decks' order. Not found by looking for the order as text:
 * an order that happens to be sorted reads the same as the public numbers left. So, structurally: each
 * public deck has exactly `cards` and `left`, `left` is as long as the secret order, and the view has no
 * other contingency field.
 */
export function contingencyLeaksIn(view: PlayerView, state: GameState): string[] {
  const found: string[] = [];
  const { contingency, ...rest } = view.public;
  for (const side of SIDES) {
    const keys = Object.keys(contingency[side]).sort();
    if (!sameJson(keys, ["cards", "left"])) found.push(`${side}'s Contingency deck with the fields ${keys.join(", ")}`);
    if (contingency[side].left.length !== state.secret.contingency[side].length) {
      found.push(`${side}'s Contingency deck with a count left that is not the secret order's`);
    }
  }
  const sides = Object.keys(contingency).sort();
  if (!sameJson(sides, ["lio", "sae"])) found.push(`Contingency decks for ${sides.join(", ")}`);
  for (const field of contingencyFields({ ...view, public: rest }, "view")) found.push(`the field ${field}`);
  return found;
}

/** The card IDs `viewer` may not see: the draw pile, the eras still to enter, and every hand but the viewer's own. */
export function hiddenFrom(state: GameState, viewer: Viewer): CardId[] {
  const hands = SIDES.filter((side) => side !== viewer).flatMap((side) => state.private[side].hand);
  const waiting = state.secret.eras.flatMap((entry) => entry.cards);
  return [...state.secret.deck, ...waiting, ...hands];
}

/**
 * What `text`, JSON sent to a viewer, gives away. The seed and each hidden card ID are looked for as a whole
 * quoted JSON string, so "c1" is not set off by "c10"; the generator state by its exact JSON text.
 */
export function leaksIn(text: string, secrets: Secrets): string[] {
  const found: string[] = [];
  if (text.includes(JSON.stringify(secrets.seed))) found.push("the seed");
  if (text.includes(JSON.stringify(secrets.rng))) found.push("the generator state");
  for (const card of secrets.hidden) {
    if (text.includes(JSON.stringify(card))) found.push(`card ${JSON.stringify(card)}`);
  }
  return found;
}

/**
 * Invariant 4: no view, and no list of this step's events, gives a viewer the seed, the generator state,
 * a card hidden from it in `state` (the state after the step) or a Contingency deck's order. No event
 * carries a contingency field at all.
 */
export function checkNoLeaks(state: GameState, events: readonly GameEvent[], seed: Seed): void {
  for (const viewer of VIEWERS) {
    const secrets: Secrets = { seed, rng: state.secret.rng, hidden: hiddenFrom(state, viewer) };
    const view = attempt(`viewFor('${viewer}')`, () => viewFor(state, viewer));
    const viewLeaks = [...leaksIn(JSON.stringify(view), secrets), ...contingencyLeaksIn(view, state)];
    if (viewLeaks.length > 0) throw new Error(`the view for '${viewer}' shows ${viewLeaks.join(", ")}`);
    const seen = attempt(`eventsFor('${viewer}')`, () => eventsFor(events, viewer));
    const eventLeaks = [
      ...leaksIn(JSON.stringify(seen), secrets),
      ...contingencyFields(seen, "events").map((field) => `the field ${field}`),
    ];
    if (eventLeaks.length > 0) throw new Error(`the events for '${viewer}' show ${eventLeaks.join(", ")}`);
  }
}

/**
 * Every view (each side and the spectator) shows the true fingerprint of the seed. It is compared with
 * seedHash(seed) worked out here from the seed, not with the state's own meta.seedHash.
 */
export function checkSeedHash(state: GameState, seed: Seed): void {
  const expected = seedHash(seed);
  for (const viewer of VIEWERS) {
    const view = attempt(`viewFor('${viewer}')`, () => viewFor(state, viewer));
    if (view.meta.seedHash !== expected) {
      throw new Error(`the view for '${viewer}' shows a seedHash that is not the hash of the seed`);
    }
  }
}

/** Invariant 5: for each side, `reconstruct` rebuilds the exact state from its view and hidden part. */
export function checkRebuilds(state: GameState): void {
  for (const side of SIDES) {
    // Frozen too, so reconstruct gets frozen inputs like every other engine call.
    const view = deepFreeze(attempt(`viewFor('${side}')`, () => viewFor(state, side)));
    const hidden = deepFreeze(attempt(`hiddenPart('${side}')`, () => hiddenPart(state, side)));
    const rebuilt = attempt(`reconstruct for '${side}'`, () => reconstruct(view, hidden));
    const diff = firstDifference(rebuilt, state, "state");
    if (diff !== null) throw new Error(`reconstruct for '${side}' does not rebuild the state: ${diff} differs`);
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Where two plain JSON values first differ, as a path starting at `path`, or null if they are equal. */
export function firstDifference(a: unknown, b: unknown, path: string): string | null {
  if (Object.is(a, b)) return null;
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return path;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) return `${path}.${key}`;
    const diff = firstDifference(a[key], b[key], `${path}.${key}`);
    if (diff !== null) return diff;
  }
  return null;
}
