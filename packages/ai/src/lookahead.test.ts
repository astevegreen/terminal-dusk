// The Hard tier looks ahead (A18, issue #507): on a real position, Medium's greedy card hands the rival the score
// track within two card plays a side, and Hard picks another. The position is game 5 of the base game on the test
// map, played by noise-free Medium up to LIO's first card play of turn 3, the last turn of Era 1, so the track is
// scored as Era 1 ends (2 plays per turn, Era 2 entering on turn 4; owner, 21 Nov 2026). There Medium plays
// e1-lio-004 for its event, and SAE takes the track.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { apply, viewFor } from "@terminal-dusk/engine";
import type { AnswerValue, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hardAnswer } from "./hard.ts";
import { mediumAnswer } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { newFirstDeckMapGame } from "./test/mapGames.ts";
import type { TestState } from "./test/testGames.ts";
import type { HardWeights } from "./types.ts";
import { HARD_WEIGHTS } from "./weights/hard.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

const rules = FIRST_DECK_RULESET;
/** A search small enough for a unit test that still looks two card plays a side ahead. */
const LOOK: HardWeights = { ...HARD_WEIGHTS, guesses: 6, candidates: 4, rounds: 2 };
const QUIET = { ...MEDIUM_WEIGHTS, noise: 0 };

/**
 * What really follows `first` by `side` on the real `state`: both sides play on as noise-free Medium until each has
 * played 2 more cards. Returns how far the score track moved towards `side`.
 */
function trackMoveAfter(state: TestState, side: Side, first: AnswerValue): number {
  const lean = (s: TestState): number => (side === "lio" ? -(s.public.score ?? 0) : (s.public.score ?? 0));
  const d0 = state.public.pending.find((d) => d.side === side)!;
  const opened = apply(rules, state, { decisionId: d0.id, side, value: first });
  if (!opened.ok) throw new Error(`refused ${JSON.stringify(first)}`);
  let s = opened.value.state;
  const plays = { lio: 0, sae: 0 };
  for (let n = 0; n < 60 && s.public.status.kind === "active" && Math.min(plays.lio, plays.sae) < 2; n++) {
    const d = s.public.pending[0]!;
    const value = mediumAnswer(rules, viewFor(s, d.side), d.side, QUIET, seededRandom(n))!;
    const next = apply(rules, s, { decisionId: d.id, side: d.side, value });
    if (!next.ok) throw new Error(`refused ${JSON.stringify(value)}`);
    if (value.kind === "chooseCard" || value.kind === "playCardAs") plays[d.side]++;
    s = next.value.state;
  }
  return lean(s) - lean(state);
}

/** Game `seed` played by noise-free Medium up to LIO's first card play of `turn`. */
function lioFirstPlayOf(seed: number, turn: number): TestState {
  let s = newFirstDeckMapGame(seed);
  for (let n = 0; s.public.status.kind === "active"; n++) {
    const d = s.public.pending[0]!;
    if (s.public.turn === turn && d.side === "lio" && d.kind === "playCardAs") return s;
    const value = mediumAnswer(rules, viewFor(s, d.side), d.side, QUIET, seededRandom(n))!;
    const next = apply(rules, s, { decisionId: d.id, side: d.side, value });
    if (!next.ok) throw new Error(`refused ${JSON.stringify(value)}`);
    s = next.value.state;
  }
  throw new Error(`game ${seed} ended before LIO played a card on turn ${turn}`);
}

describe("the Hard tier's lookahead", () => {
  it("avoids the card that lets the rival take the score track within 2 rounds, which Medium plays", () => {
    const state = lioFirstPlayOf(5, 3);
    const decision = state.public.pending.find((d) => d.side === "lio")!;
    const view = viewFor(state, "lio");
    const medium = mediumAnswer(rules, view, "lio", MEDIUM_WEIGHTS, seededRandom(7));
    expect(medium).toEqual({ kind: "playCardAs", card: "e1-lio-004", as: "event" });
    const hard = hardAnswer(rules, view, "lio", LOOK, seededRandom(7));
    expect(decision.kind).toBe("playCardAs");
    expect(hard).not.toEqual(medium);
    // Medium's card lets SAE move the track far its way; Hard's keeps it nearly level.
    expect(trackMoveAfter(state, "lio", medium!)).toBeLessThanOrEqual(-10);
    expect(trackMoveAfter(state, "lio", hard!)).toBeGreaterThan(trackMoveAfter(state, "lio", medium!) + 10);
  });
});
