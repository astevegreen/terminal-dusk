// The fuzz check for trigger filters and once (R7a, #190): a filtered trigger fires only when its filter held at
// its hook, a waiting trigger whose filter held does fire, and a once trigger fires at most once and then leaves.
// play.ts runs it after every step, with the state before the step, the step's events and the state after it.
//
// Trigger events name only the card that set a trigger and its hook, and a card (or its reaction) can set more
// than one trigger on the same hook, so the check follows each trigger by its place in `public.triggers`: it
// starts from the list before the step and replays the step's trigger events on it, in order.
import type { CardId, GameEvent, GameState, HookId, Ruleset, Side, Step, TriggerFilter } from "@terminal-dusk/engine";
import { isLasting } from "./markers.ts";

/** What the check saw in one step, for the fuzz tests' counts. */
export type FilterCounts = {
  /** Triggers with a filter that fired, and that did not fire because their filter failed at their hook. */
  filteredFired: number;
  filteredSkipped: number;
  /** Once triggers that fired (and so left the list), and that ended unfired at the turn's end. */
  onceFired: number;
  onceEndedUnfired: number;
};
const noCounts = (): FilterCounts => ({ filteredFired: 0, filteredSkipped: 0, onceFired: 0, onceEndedUnfired: 0 });

/** A trigger's filter and once, or "unknown" for one set in this step whose card sets differing triggers on its hook. */
type Kind = { filter?: TriggerFilter | undefined; once?: true | undefined } | "unknown";
/** One trigger in the list as the check follows it. */
type Entry = { source: CardId; hook: HookId; kind: Kind };
type Play = { side: Side; card: CardId | null };

/** Every `trigger` step in `steps`, at any depth. */
function triggersIn(steps: readonly Step[]): Extract<Step, { op: "trigger" }>[] {
  return steps.flatMap((step) => {
    if (step.op === "trigger") return [step, ...triggersIn(step.do)];
    if (step.op === "if") return triggersIn([...step.then, ...(step.else ?? [])]);
    return step.op === "forEach" ? triggersIn(step.do) : [];
  });
}

/**
 * The kind of a trigger `source` set on `hook` in this step, read from the card's steps: known when every
 * trigger step on that hook in the card (reactions included) has the same filter and once.
 */
function kindFromRules(rules: Ruleset, source: CardId, hook: HookId): Kind {
  const steps = triggersIn(rules.cards.find((card) => card.id === source)?.effect ?? []).filter((s) => s.hook === hook);
  const kinds = new Set(steps.map((s) => JSON.stringify({ filter: s.filter, once: s.once })));
  if (kinds.size !== 1) return "unknown";
  return { filter: steps[0]!.filter, once: steps[0]!.once };
}

/**
 * The play whose cardPlayed hook is still to come in `state`: the next play while a side is asked to play
 * (`inPlay` empty), or the card in play while its own program has not finished (it is the stack's bottom
 * frame, or the stack is empty while its player says when a rival card's event happens). `n` counts the
 * plays this turn, this one included. Null in any other state (opening cards, reactions, the turn's end).
 */
function openPlay(state: GameState): { turn: number; n: number; card: CardId | null } | null {
  const pub = state.public;
  if (pub.status.kind !== "active") return null;
  if (pub.pending.some((d) => d.kind === "playCardAs")) return { turn: pub.turn, n: pub.playsMade + 1, card: null };
  const [card, bottom] = [pub.inPlay[0], pub.stack[0]];
  if (pub.playsMade === 0 || pub.inPlay.length !== 1 || card === undefined) return null;
  const own = bottom === undefined || (bottom.kind === "program" && bottom.source === card);
  return own ? { turn: pub.turn, n: pub.playsMade, card } : null;
}

/**
 * The play whose cardPlayed hook happened in this step, worked out from the states as afterProgram does: one
 * was still to come before, and is not after. LIO makes the plays with an even count before them.
 */
function finishedPlay(before: GameState, after: GameState): Play | null {
  const open = openPlay(before);
  if (open === null) return null;
  const still = openPlay(after);
  if (still !== null && still.turn === open.turn && still.n === open.n) return null;
  return { side: (open.n - 1) % 2 === 0 ? "lio" : "sae", card: open.card };
}

/** True when this turn's turnEnd hook happened in this step: it had not fired before, and it has fired or the turn moved on. */
const turnEndHappened = (before: GameState, after: GameState): boolean =>
  !before.public.turnEndFired && (after.public.turnEndFired || after.public.turn !== before.public.turn);

/** Whether `entry`'s filter holds: true, false, or null when it can't be told (unknown kind, or `has` with `markers` null). */
function holds(entry: Entry, side: Side | undefined, markers: ReadonlySet<string> | null): boolean | null {
  if (entry.kind === "unknown") return null;
  const { filter } = entry.kind;
  if (filter === undefined) return true;
  if (filter.op === "playedBy") return filter.side === side;
  return markers === null ? null : markers.has(filter.marker);
}
const isFiltered = (e: Entry): boolean => e.kind !== "unknown" && e.kind.filter !== undefined;
const isOnce = (e: Entry): boolean => e.kind !== "unknown" && e.kind.once === true;
const filterText = (e: Entry): string => (e.kind === "unknown" ? "unknown" : JSON.stringify(e.kind.filter ?? null));
const sources = (entries: readonly { source: CardId }[]): string => JSON.stringify(entries.map((e) => e.source));

/**
 * (a) and (c) at the cardPlayed hook: the triggers fired, `fired`, are exactly the waiting ones whose filter
 * held for `play`, in the order they were set. Returns those that fired.
 */
function judgeCardPlayed(waiting: Entry[], play: Play, markers: ReadonlySet<string>, fired: CardId[]): Entry[] {
  const expected = waiting.filter((e) => holds(e, play.side, markers) === true);
  if (JSON.stringify(expected.map((e) => e.source)) === JSON.stringify(fired)) return expected;
  const count = (list: readonly CardId[], card: CardId) => list.filter((c) => c === card).length;
  const want = expected.map((e) => e.source);
  for (const card of new Set([...want, ...fired])) {
    const failed = waiting.find((e) => e.source === card && !expected.includes(e));
    if (count(fired, card) > count(want, card)) {
      const why =
        failed === undefined ? "more often than it was waiting" : `though its filter ${filterText(failed)} failed`;
      throw new Error(`${card}'s cardPlayed trigger fired for a play by ${play.side} ${why}`);
    }
    if (count(fired, card) < count(want, card)) {
      const held = expected.find((e) => e.source === card)!;
      throw new Error(
        `${card}'s cardPlayed trigger did not fire for a play by ${play.side}, though its filter ${filterText(held)} held`,
      );
    }
  }
  throw new Error(
    `the cardPlayed triggers fired in the order ${JSON.stringify(fired)}, not as set: ${sources(expected)}`,
  );
}

/** At the turnEnd hook, an outcome for each waiting trigger that agrees with the events: which fired, which ended. */
function turnEndOutcomes(
  waiting: Entry[],
  told: (boolean | null)[],
  ended: CardId[],
  fired: CardId[],
): boolean[] | null {
  const go = (i: number, e: number, f: number, out: boolean[]): boolean[] | null => {
    if (i === waiting.length) return e === ended.length && f === fired.length ? out : null;
    const { source } = waiting[i]!;
    const fires = told[i] !== false && fired[f] === source ? go(i + 1, e, f + 1, [...out, true]) : null;
    if (fires !== null) return fires;
    return told[i] !== true && ended[e] === source ? go(i + 1, e + 1, f, [...out, false]) : null;
  };
  return go(0, 0, 0, []);
}

/**
 * The turnEnd hook, whose events start at `at`: every waiting turnEnd trigger leaves the list; first those
 * whose filter failed are ended, then those whose filter held (or that have none) fire, each in set order.
 * Returns the index after its events.
 */
function turnEndHook(
  list: Entry[],
  events: readonly GameEvent[],
  at: number,
  markers: Set<string>,
  counts: FilterCounts,
): number {
  const waiting = list.filter((e) => e.hook === "turnEnd");
  const batch = events.slice(at, at + waiting.length);
  const isEnded = (e: GameEvent) => e.kind === "triggerEnded" && e.hook === "turnEnd";
  const isFired = (e: GameEvent) => e.kind === "triggerFired" && e.hook === "turnEnd";
  const endedCount = batch.findIndex((e) => !isEnded(e));
  const split = endedCount === -1 ? batch.length : endedCount;
  if (batch.length < waiting.length || !batch.slice(split).every(isFired)) {
    throw new Error(
      `at the turnEnd hook, ${sources(waiting)} were waiting, but the events do not end or fire each of them`,
    );
  }
  const src = (e: GameEvent) => (e.kind === "triggerEnded" || e.kind === "triggerFired" ? e.source : "");
  const [ended, fired] = [batch.slice(0, split).map(src), batch.slice(split).map(src)];
  const told = waiting.map((e) => holds(e, undefined, markers));
  const out = turnEndOutcomes(waiting, told, ended, fired);
  if (out === null) {
    const by = (want: boolean) => sources(waiting.filter((_, i) => told[i] === want));
    throw new Error(
      `at the turnEnd hook, by their filters ${by(true)} should fire and ${by(false)} end, ` +
        `but ${JSON.stringify(fired)} fired and ${JSON.stringify(ended)} ended`,
    );
  }
  waiting.forEach((e, i) => {
    if (isFiltered(e)) counts[out[i] ? "filteredFired" : "filteredSkipped"]++;
  });
  list.splice(0, list.length, ...list.filter((e) => e.hook !== "turnEnd"));
  return at + waiting.length;
}

/** A triggerEnded outside the turnEnd hook: the turn ended, and the first waiting trigger it names leaves the list. */
function endOne(list: Entry[], event: { source: CardId; hook: HookId }, i: number, counts: FilterCounts): void {
  const at = list.findIndex((e) => e.source === event.source && e.hook === event.hook);
  if (at === -1) {
    throw new Error(`event ${i}: triggerEnded names ${event.source}'s ${event.hook} trigger, but none is waiting`);
  }
  if (isOnce(list[at]!)) counts.onceEndedUnfired++;
  list.splice(at, 1);
}

/**
 * The check for one step. (a) A cardPlayed trigger filtered on playedBy fires only for a play by that side,
 * and a `has` filter only once its marker is set: the markers before the step plus the lasting `marker`
 * events before the hook's `triggerFired` events. (b) A once trigger fires at most once: it leaves the list
 * when it fires, and no later `triggerEnded` names it. (c) A waiting trigger whose filter held at its hook
 * fired. When no cardPlayed trigger fired, the hook's place among the events is unknown, so (c) covers a
 * `has` filter only when its marker's presence is the same before and after the step. A trigger set in this
 * step whose card sets triggers of differing filters or once on that hook is judged only for its order.
 * The playing side is worked out from the states, as afterProgram does, never from who answered.
 */
export function checkTriggerFilters(
  rules: Ruleset,
  before: GameState,
  events: readonly GameEvent[],
  after: GameState,
): FilterCounts {
  const counts = noCounts();
  const status = after.public.status;
  // A game that ends at the score track's end (R21) ends in endTurn too, after the turnEnd hook, like the last turn.
  if (status.kind === "over" && status.reason !== "turnLimitReached" && status.reason !== "trackEnd") return counts;
  const play = finishedPlay(before, after);
  let turnEnd = turnEndHappened(before, after);
  const list: Entry[] = before.public.triggers.map((t) => ({
    source: t.source,
    hook: t.hook,
    kind: { filter: t.filter, once: t.once },
  }));
  // Every trigger set in this step before the cardPlayed hook is the played card's own, which never fires for it.
  const waitingCp = list.filter((e) => e.hook === "cardPlayed" && e.source !== play?.card);
  const markers = new Set(before.public.markers);
  let cardPlayedDone = false;
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (isLasting(event)) markers.add(event.label);
    if (event.kind === "triggerSet") {
      list.push({ source: event.source, hook: event.hook, kind: kindFromRules(rules, event.source, event.hook) });
    } else if (event.kind === "triggerFired" && event.hook === "cardPlayed") {
      if (play === null || cardPlayedDone) {
        throw new Error(`event ${i}: ${event.source}'s cardPlayed trigger fired, but no play's cardPlayed hook is due`);
      }
      const end = events.findIndex((e, j) => j > i && !(e.kind === "triggerFired" && e.hook === "cardPlayed"));
      const fired = events
        .slice(i, end === -1 ? events.length : end)
        .map((e) => (e.kind === "triggerFired" ? e.source : ""));
      const firing = judgeCardPlayed(waitingCp, play, markers, fired);
      countCardPlayed(waitingCp, firing, counts);
      list.splice(0, list.length, ...list.filter((e) => !(isOnce(e) && firing.includes(e))));
      cardPlayedDone = true;
      i += fired.length - 1;
    } else if (event.kind === "triggerFired" || event.kind === "triggerEnded") {
      if (turnEnd && list.some((e) => e.hook === "turnEnd")) {
        i = turnEndHook(list, events, i, markers, counts) - 1;
        turnEnd = false;
      } else if (event.kind === "triggerFired") {
        throw new Error(`event ${i}: ${event.source}'s turnEnd trigger fired, but this turn's turnEnd hook is not due`);
      } else endOne(list, event, i, counts);
    }
  }
  if (play !== null && !cardPlayedDone) noneFired(waitingCp, play, before, after, counts);
  const left = after.public.triggers.map((t) => `${t.source}:${t.hook}`);
  const expected = list.map((e) => `${e.source}:${e.hook}`);
  if (JSON.stringify(left) !== JSON.stringify(expected)) {
    throw new Error(
      `after the step the triggers are ${JSON.stringify(left)}, but its events leave ${JSON.stringify(expected)}`,
    );
  }
  return counts;
}

/** Counts the waiting cardPlayed triggers: filtered ones that fired or were skipped, and once ones that fired. */
function countCardPlayed(waiting: Entry[], firing: Entry[], counts: FilterCounts): void {
  for (const e of waiting) {
    if (isFiltered(e)) counts[firing.includes(e) ? "filteredFired" : "filteredSkipped"]++;
    if (isOnce(e) && firing.includes(e)) counts.onceFired++;
  }
}

/**
 * (c) when the cardPlayed hook fired no trigger: none of the waiting ones had a filter that held. A `has`
 * filter is judged only when its marker's presence is the same before and after the step.
 */
function noneFired(waiting: Entry[], play: Play, before: GameState, after: GameState, counts: FilterCounts): void {
  const [was, now] = [new Set(before.public.markers), new Set(after.public.markers)];
  for (const e of waiting) {
    const label = e.kind !== "unknown" && e.kind.filter?.op === "has" ? e.kind.filter.marker : null;
    const known = label === null || was.has(label) === now.has(label) ? was : null;
    const held = holds(e, play.side, known);
    if (held === true) {
      throw new Error(
        `${e.source}'s cardPlayed trigger did not fire for a play by ${play.side}, though its filter ${filterText(e)} held`,
      );
    }
    if (held === false) counts.filteredSkipped++;
  }
}
