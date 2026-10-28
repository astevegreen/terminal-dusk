// The reaction cards' filtered and once triggers (filtered.ts, #190): every variant is on a LIO, an SAE and a
// neutral card, and fuzz games fire them, skip them, and end them as the filter and once check counts.
import { apply, createGame } from "@terminal-dusk/engine";
import type { Ruleset, Step } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { checkTriggerFilters } from "./filterChecks.ts";
import type { FilterCounts } from "./filterChecks.ts";
import { FILTERED, VARIANTS } from "./filtered.ts";
import type { Variant } from "./filtered.ts";
import { ruleset } from "./play.ts";
import type { GameRecord } from "./play.ts";
import { playReactionGame, reactionsRuleset } from "./reactions.ts";

/** A fixed number of reaction games, whatever FUZZ_GAMES says, so the counts below are the same on every run. */
const GAMES = 200;

/** The variant a trigger step is, read from its hook, filter and once alone; null for an unfiltered, repeating one. */
function variantOfStep(step: Extract<Step, { op: "trigger" }>): Variant | null {
  const { filter, once, hook } = step;
  if (once === true) return filter === undefined ? "once" : "filterAndOnce";
  if (filter === undefined) return null;
  if (filter.op === "has") return hook === "turnEnd" ? "hasOnTurnEnd" : "hasOnCardPlayed";
  return filter.side === "lio" ? "playedByLio" : "playedBySae";
}

describe("the reaction cards' filtered and once triggers", () => {
  it("each variant is set by at least one LIO, one SAE and one neutral card", () => {
    const by = new Map<Variant, Set<string>>();
    for (const card of reactionsRuleset.cards) {
      for (const step of card.effect) {
        const variant = step.op === "trigger" ? variantOfStep(step) : null;
        if (variant !== null) by.set(variant, (by.get(variant) ?? new Set()).add(card.affiliation));
      }
    }
    for (const variant of VARIANTS)
      expect([variant, by.get(variant)]).toEqual([variant, new Set(["lio", "sae", "neutral"])]);
  });
  it("each reacts with a marker naming its variant, and card ids and affiliations stay as the fuzz cards'", () => {
    const sameCards = (rules: Ruleset) => rules.cards.map((card) => `${card.id}:${card.affiliation}`);
    expect(sameCards(reactionsRuleset)).toEqual(sameCards(ruleset));
    for (const step of reactionsRuleset.cards.flatMap((card) => card.effect)) {
      const variant = step.op === "trigger" ? variantOfStep(step) : null;
      if (step.op === "trigger" && variant !== null) {
        expect(step.do).toEqual([{ op: "marker", label: `${FILTERED}${variant}`, var: expect.any(String) }]);
      }
    }
  });
});

/** The check's counts over every step of a game replayed answer by answer. */
function countsOf(record: GameRecord): FilterCounts {
  const total: FilterCounts = { filteredFired: 0, filteredSkipped: 0, onceFired: 0, onceEndedUnfired: 0 };
  const created = createGame(reactionsRuleset, record.setup, record.seed);
  if (!created.ok) throw new Error(`createGame failed: ${created.error.code}`);
  let state = created.value.state;
  for (const answer of record.answers) {
    const r = apply(reactionsRuleset, state, answer);
    if (!r.ok) throw new Error(`apply failed: ${r.error.code}`);
    const counts = checkTriggerFilters(reactionsRuleset, state, r.value.events, r.value.state);
    for (const key of Object.keys(total) as (keyof FilterCounts)[]) total[key] += counts[key];
    state = r.value.state;
  }
  return total;
}

describe("filtered and once triggers in fuzz games", () => {
  it(
    `over ${GAMES} reaction games, filtered triggers fire and are skipped, and once triggers fire and leave or end unfired`,
    () => {
      const total: FilterCounts = { filteredFired: 0, filteredSkipped: 0, onceFired: 0, onceEndedUnfired: 0 };
      for (let game = 1; game <= GAMES; game++) {
        // playReactionGame runs the check on every step, and throws with the game's record when one fails.
        const counts = countsOf(playReactionGame(game).record);
        for (const key of Object.keys(total) as (keyof FilterCounts)[]) total[key] += counts[key];
      }
      expect(total.filteredFired).toBeGreaterThan(0);
      expect(total.filteredSkipped).toBeGreaterThan(0);
      expect(total.onceFired).toBeGreaterThan(0);
      expect(total.onceEndedUnfired).toBeGreaterThan(0);
    },
    // Measured 28 Oct 2026: about 25 ms per game alone, about 100 ms with the whole fuzz folder running in parallel.
    // The limit is 500 ms per game, five times the busy figure.
    GAMES * 500,
  );
});
