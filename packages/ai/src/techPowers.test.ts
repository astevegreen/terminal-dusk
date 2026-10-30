// The AI and the tech race step powers (A18, issue #510; docs/design/tech-race.md, "What each step gives"): Medium
// weighs each power a side holds, takes Hypersonics' extra play, and both tiers answer the extra play and Quantum
// Computing's one-sided opening pick in whole games.
import { FIRST_DECK_RULESET } from "@terminal-dusk/content/first-deck";
import { viewFor } from "@terminal-dusk/engine";
import type { AnswerValue, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { techValue } from "./evaluate.ts";
import { mediumAnswer } from "./medium.ts";
import { seededRandom } from "./random.ts";
import { newSixRegionMapGame } from "./test/mapGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

const W = MEDIUM_WEIGHTS;

/** `state` with the tech race marker at `marker` and every step up to it already reached. */
function withMarker(state: TestState, marker: number): TestState {
  const reached = Array.from({ length: Math.abs(marker) }, (_, i) => i + 1);
  return { ...state, public: { ...state.public, techRace: { ...state.public.techRace!, marker, reached } } };
}

type Seen = { extraPlays: TestState[]; passes: number; plays: number; oneSided: { rival: number; holder: number } };

/** Plays a six-region game from `seed` with the marker starting at `marker`, noting the extra plays and one-sided picks. */
function play(seed: number, marker: number, tier: "easy" | "medium"): Seen & { over: boolean } {
  const seen: Seen = { extraPlays: [], passes: 0, plays: 0, oneSided: { rival: 0, holder: 0 } };
  const final = playEasy(
    FIRST_DECK_RULESET,
    withMarker(newSixRegionMapGame(seed), marker),
    tier === "easy" ? EASY_WEIGHTS : MEDIUM_WEIGHTS,
    seededRandom(seed),
    {
      ...(tier === "medium" ? { answerWith: mediumAnswer } : {}),
      applied: (before, _after, _events, answer) => {
        if (!("value" in answer)) return;
        const decision = before.public.pending.find((d) => d.id === answer.decisionId)!;
        if (decision.kind === "extraPlay") {
          seen.extraPlays.push(before);
          if (answer.value.kind === "pass") seen.passes++;
          else seen.plays++;
        }
        // Quantum Computing's picks are one at a time, with no simultaneous group: the rival's with nothing in play,
        // the holder's with the rival's card face up.
        const held = Math.abs(before.public.techRace!.marker) === before.public.map!.techRace!.steps.length;
        if (decision.kind === "chooseCard" && held && decision.simultaneousGroup === undefined) {
          seen.oneSided[before.public.inPlay.length === 0 ? "rival" : "holder"]++;
        }
      },
    },
  );
  return { ...seen, over: final.public.status.kind === "over" };
}

const pubAt = (marker: number) => {
  const pub = newSixRegionMapGame(1).public;
  return { ...pub, techRace: { ...pub.techRace!, marker, bonus: [] } };
};
const step = (from: number, to: number, side: Side = "lio") =>
  techValue(pubAt(to), side, W) - techValue(pubAt(from), side, W);

describe("the AI and the tech race step powers", () => {
  it("Medium has a positive weight for each step's power, as data", () => {
    for (const key of ["techRealign", "techIntervene", "techExtraPlay", "techOpening"] as const) {
      expect(W[key]).toBeGreaterThan(0);
    }
  });

  it("Medium weighs each power gained on a step: realign, intervene, the extra play, the opening order", () => {
    expect(step(0, -1)).toBeCloseTo(W.tech + W.techRealign);
    expect(step(-1, -2)).toBeCloseTo(W.tech + W.techIntervene);
    expect(step(-2, -3)).toBeCloseTo(W.tech + W.techExtraPlay);
    expect(step(-3, -4)).toBeCloseTo(W.tech + W.techOpening + W.region);
  });

  it("counts the rival's powers against the side, the same amount for either side", () => {
    for (let marker = -4; marker <= 4; marker++) {
      expect(techValue(pubAt(marker), "lio", W)).toBeCloseTo(-techValue(pubAt(marker), "sae", W));
      expect(techValue(pubAt(marker), "sae", W)).toBeCloseTo(techValue(pubAt(-marker), "lio", W));
    }
    expect(step(0, 2)).toBeCloseTo(-(W.tech * 2 + W.techRealign + W.techIntervene));
  });

  it("Easy answers Hypersonics' extra play, mostly making it, and its games end", () => {
    let plays = 0;
    let offered = 0;
    for (const seed of [1, 2, 3]) {
      for (const marker of [-3, 3]) {
        const seen = play(seed, marker, "easy");
        expect(seen.over).toBe(true);
        offered += seen.extraPlays.length;
        plays += seen.plays;
      }
    }
    expect(offered).toBeGreaterThan(0);
    expect(plays * 2).toBeGreaterThan(offered);
  });

  it("Medium makes Hypersonics' extra play whenever a card in its hand is safe to play", () => {
    let offered = 0;
    for (const seed of [1, 2]) {
      for (const marker of [-3, 3]) {
        const seen = play(seed, marker, "medium");
        expect(seen.over).toBe(true);
        for (const state of seen.extraPlays) {
          // Below Escalation 3 no first-deck card can raise it to 6, so every card in hand is safe.
          if ((state.public.escalation ?? 0) > 2) continue;
          offered++;
          const side = state.public.pending[0]!.side;
          const answer: AnswerValue | null = mediumAnswer(
            FIRST_DECK_RULESET,
            viewFor(state, side),
            side,
            W,
            seededRandom(7),
          );
          expect(answer?.kind).not.toBe("pass");
        }
      }
    }
    expect(offered).toBeGreaterThan(0);
  });

  it("Easy and Medium answer Quantum Computing's one-sided opening pick, as the rival and as the holder", () => {
    for (const tier of ["easy", "medium"] as const) {
      for (const marker of [-4, 4]) {
        const seen = play(1, marker, tier);
        expect(seen.over).toBe(true);
        expect(seen.oneSided.rival, `${tier} ${marker}`).toBeGreaterThan(0);
        expect(seen.oneSided.holder, `${tier} ${marker}`).toBeGreaterThan(0);
      }
    }
  });
});
