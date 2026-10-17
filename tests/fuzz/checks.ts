// The invariant checks the fuzz suite runs on every state (docs/architecture.md, "Guardrails", "Fuzz suite").
// Each check throws an Error saying what is wrong; play.ts adds the game's seed and answers to it.
import { eventsFor, hiddenPart, legalAnswers, pendingFor, reconstruct, SIDES, viewFor } from "@terminal-dusk/engine";
import type { CardId, GameEvent, GameState, Ruleset, Seed, Viewer } from "@terminal-dusk/engine";
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

/** All the checks for one step: invariants 1, 4 and 5. `events` are the ones that step produced. */
export function checkStep(ruleset: Ruleset, state: GameState, events: readonly GameEvent[], seed: Seed): void {
  checkLive(ruleset, state);
  checkNoLeaks(state, events, seed);
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

/** The card IDs `viewer` may not see: the draw pile, plus every hand but the viewer's own. */
export function hiddenFrom(state: GameState, viewer: Viewer): CardId[] {
  const hands = SIDES.filter((side) => side !== viewer).flatMap((side) => state.private[side].hand);
  return [...state.secret.deck, ...hands];
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
 * Invariant 4: no view, and no list of this step's events, gives a viewer the seed, the generator state
 * or a card hidden from it in `state` (the state after the step).
 */
export function checkNoLeaks(state: GameState, events: readonly GameEvent[], seed: Seed): void {
  for (const viewer of VIEWERS) {
    const secrets: Secrets = { seed, rng: state.secret.rng, hidden: hiddenFrom(state, viewer) };
    const view = attempt(`viewFor('${viewer}')`, () => viewFor(state, viewer));
    const viewLeaks = leaksIn(JSON.stringify(view), secrets);
    if (viewLeaks.length > 0) throw new Error(`the view for '${viewer}' shows ${viewLeaks.join(", ")}`);
    const seen = attempt(`eventsFor('${viewer}')`, () => eventsFor(events, viewer));
    const eventLeaks = leaksIn(JSON.stringify(seen), secrets);
    if (eventLeaks.length > 0) throw new Error(`the events for '${viewer}' show ${eventLeaks.join(", ")}`);
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
