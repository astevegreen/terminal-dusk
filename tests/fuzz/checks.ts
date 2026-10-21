// The invariant checks the fuzz suite runs on every state (docs/architecture.md, "Guardrails", "Fuzz suite").
// Each check throws an Error saying what is wrong; play.ts adds the game's seed and answers to it.
import {
  DECKS,
  eventsFor,
  hiddenPart,
  legalAnswers,
  pendingFor,
  reconstruct,
  seedHash,
  SIDES,
  verifyGame,
  viewFor,
} from "@terminal-dusk/engine";
import type {
  Answer,
  CardId,
  DeckId,
  GameEvent,
  GameState,
  ModifierExpiry,
  PlayerView,
  Ruleset,
  Seed,
  Setup,
  Viewer,
} from "@terminal-dusk/engine";
import { deepFreeze } from "./deepFreeze.ts";
import { checkHasBranches, checkMarkers } from "./markerChecks.ts";
import { byCodeUnit } from "./order.ts";

export { checkHasBranches, checkMarkers } from "./markerChecks.ts";

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
 * The game so far, for the lasting marker checks: the lasting markers before the step (null for the state
 * createGame made) and every event of the game in order, the step's own included.
 */
export type History = { before: readonly string[] | null; allEvents: readonly GameEvent[] };
/** The history of the state createGame made, with no events. */
export const NEW_GAME: History = { before: null, allEvents: [] };

/**
 * All the checks for one step: invariants 1, 3, 4 and 5, the Contingency decks, and the lasting markers and
 * `has` branches (markerChecks.ts). `events` are the ones that step produced.
 */
export function checkStep(
  ruleset: Ruleset,
  setup: Setup,
  state: GameState,
  events: readonly GameEvent[],
  seed: Seed,
  history: History,
): void {
  checkLive(ruleset, state);
  checkModifiers(state);
  checkTriggers(state);
  checkCards(setup, state);
  checkContingency(setup, state);
  checkNoLeaks(state, events, seed);
  checkSeedHash(state, seed);
  checkRebuilds(state);
  checkMarkers(state, events, history.before);
  checkHasBranches(history.allEvents);
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
 * Modifiers end with the turn they were made in (#89): while the game is active, every modifier in force
 * expires at the end of the current turn; once it is over, none is left. Runs on finished games too.
 */
export function checkModifiers(state: GameState): void {
  checkEndsThisTurn(state, "modifiers", state.public.modifiers);
}

/**
 * Triggers end with the turn they were set in (#90), as modifiers do; and while a play is open, this turn's
 * turnEnd hook has not fired yet. Runs on finished games too.
 */
export function checkTriggers(state: GameState): void {
  checkEndsThisTurn(state, "triggers", state.public.triggers);
  const { pending, turnEndFired } = state.public;
  if (turnEndFired && pending.some((d) => d.kind === "playCardAs")) {
    throw new Error("a play is open, but this turn's turnEnd hook has already fired");
  }
}

/** While the game is active, each of `items` (`what`) ends with the current turn; once it is over, none is left. */
function checkEndsThisTurn(state: GameState, what: string, items: readonly { expires: ModifierExpiry }[]): void {
  const { status, turn } = state.public;
  if (status.kind === "over") {
    if (items.length > 0) throw new Error(`the game is over, but ${items.length} ${what} are still in force`);
    return;
  }
  const stale = items.filter((m) => m.expires.kind !== "turnEnd" || m.expires.turn !== turn);
  if (stale.length > 0) {
    throw new Error(`in turn ${turn}, ${what} that do not end with this turn are in force: ${JSON.stringify(stale)}`);
  }
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
  const found = [...state.secret.deck, ...hands, ...state.public.discard, ...state.public.inPlay].sort(byCodeUnit);
  const expected = enteredCards(setup, state.public.turn).sort(byCodeUnit);
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

/** A Contingency deck's name in a failure: "lio's Contingency deck", or "the World deck" (#131). */
const deckName = (deck: DeckId): string => (deck === "world" ? "the World deck" : `${deck}'s Contingency deck`);

/**
 * The Contingency decks (#64), for each side and the World deck (#131): the full contents are the setup's deck, sorted; the numbers
 * left are the secret order, sorted, and a sub-multiset of the full contents; the deck holds at least 3
 * cards, so the engine never draws from fewer. The public lists are compared as they are, never re-sorted here, so a list in draw order is caught.
 */
export function checkContingency(setup: Setup, state: GameState): void {
  for (const side of DECKS) {
    const { cards, left } = state.public.contingency[side];
    const order = state.secret.contingency[side];
    const deck = deckName(side);
    if (!sameJson(cards, ascending(setup.contingency[side]))) {
      throw new Error(`${deck}: the full contents ${JSON.stringify(cards)} are not the setup's deck, sorted`);
    }
    if (!sameJson(left, ascending(order))) {
      throw new Error(`${deck}: the numbers left ${JSON.stringify(left)} are not the secret order, sorted`);
    }
    if (!isSubMultiset(left, cards)) {
      throw new Error(`${deck}: the numbers left ${JSON.stringify(left)} are not all in ${JSON.stringify(cards)}`);
    }
    if (order.length < 3) throw new Error(`${deck} holds ${order.length} cards; it must always hold 3 or more`);
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
  for (const side of DECKS) {
    const keys = Object.keys(contingency[side]).sort(byCodeUnit);
    if (!sameJson(keys, ["cards", "left"])) found.push(`${deckName(side)} with the fields ${keys.join(", ")}`);
    if (contingency[side].left.length !== state.secret.contingency[side].length) {
      found.push(`${deckName(side)} with a count left that is not the secret order's`);
    }
  }
  const sides = Object.keys(contingency).sort(byCodeUnit);
  if (!sameJson(sides, ["lio", "sae", "world"])) found.push(`Contingency decks for ${sides.join(", ")}`);
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
 * The cards a refill in this step shuffled from the discard pile into a new draw pile
 * (docs/design/core-loop.md, "Refilling hands"): the draw pile now, plus the cards drawn after the reshuffle.
 * Nothing else takes cards from the draw pile between a refill and the next decision. Empty with no reshuffle.
 */
export function reshuffledCards(state: GameState, events: readonly GameEvent[]): CardId[] {
  const at = events.findLastIndex((event) => event.kind === "drawPileReshuffled");
  if (at === -1) return [];
  const drawnAfter = events.slice(at + 1).flatMap((event) => (event.kind === "cardDrawn" ? [event.card] : []));
  return [...state.secret.deck, ...drawnAfter];
}

/**
 * Invariant 4: no view, and no list of this step's events, gives a viewer the seed, the generator state,
 * a card hidden from it in `state` (the state after the step) or a Contingency deck's order. No event
 * carries a contingency field at all. One exception: the events up to a reshuffle may name the cards it
 * shuffled, which lay face up in the discard pile until then (a card played in the open, say). The events
 * after the reshuffle get the full check, so naming a card a side then drew is still a leak.
 */
export function checkNoLeaks(state: GameState, events: readonly GameEvent[], seed: Seed): void {
  const reshuffled = new Set(reshuffledCards(state, events));
  const at = events.findLastIndex((event) => event.kind === "drawPileReshuffled");
  for (const viewer of VIEWERS) {
    const secrets: Secrets = { seed, rng: state.secret.rng, hidden: hiddenFrom(state, viewer) };
    const view = attempt(`viewFor('${viewer}')`, () => viewFor(state, viewer));
    const viewLeaks = [...leaksIn(JSON.stringify(view), secrets), ...contingencyLeaksIn(view, state)];
    if (viewLeaks.length > 0) throw new Error(`the view for '${viewer}' shows ${viewLeaks.join(", ")}`);
    const upTo: Secrets = { ...secrets, hidden: secrets.hidden.filter((card) => !reshuffled.has(card)) };
    const seenUpTo = attempt(`eventsFor('${viewer}')`, () => eventsFor(events.slice(0, at + 1), viewer));
    const seenAfter = attempt(`eventsFor('${viewer}')`, () => eventsFor(events.slice(at + 1), viewer));
    const eventLeaks = [
      ...leaksIn(JSON.stringify(seenUpTo), upTo),
      ...leaksIn(JSON.stringify(seenAfter), secrets),
      ...contingencyFields([...seenUpTo, ...seenAfter], "events").map((field) => `the field ${field}`),
    ];
    if (eventLeaks.length > 0)
      throw new Error(`the events for '${viewer}' show ${[...new Set(eventLeaks)].join(", ")}`);
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

/**
 * verifyGame on a game that reached its end: it must accept the record and give the same final state and
 * the same events, in order, as the game produced from createGame onwards.
 */
export function checkVerify(
  ruleset: Ruleset,
  record: { setup: Setup; seed: Seed; answers: readonly Answer[] },
  final: GameState,
  events: readonly GameEvent[],
): void {
  const r = attempt("verifyGame", () => verifyGame(ruleset, record.setup, record.seed, record.answers));
  if (!r.ok) throw new Error(`verifyGame refused the game's own record: ${r.error.code} ${r.error.message ?? ""}`);
  const stateDiff = firstDifference(r.value.state, final, "state");
  if (stateDiff !== null) throw new Error(`verifyGame gives a different final state: ${stateDiff} differs`);
  const eventsDiff = firstDifference(r.value.events, events, "events");
  if (eventsDiff !== null) throw new Error(`verifyGame gives different events: ${eventsDiff} differs`);
}
