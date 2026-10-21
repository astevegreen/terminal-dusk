// Easy on cards with lasting markers and `has` conditions (R4, issue #171).
import { reconstruct, SIDES, viewFor } from "@terminal-dusk/engine";
import type { GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { easyAnswer } from "./easy.ts";
import { guessHidden } from "./guess.ts";
import { seededRandom } from "./random.ts";
import { MARKER_LABELS, markerRuleset, newMarkerGame } from "./test/markerGames.ts";
import { playEasy } from "./test/playEasy.ts";
import type { TestState } from "./test/testGames.ts";
import { EASY_WEIGHTS } from "./weights/easy.ts";

const GAMES = 50;

type Played = {
  /** Every game's last state. */
  finals: TestState[];
  /** The events of every apply, across all games. */
  events: GameEvent[];
  /** Every state reached with a lasting marker set. */
  marked: TestState[];
  /** Of those, the states paused on a yes/no inside an `if has`, in a turn after every set marker was set. */
  pausedLater: TestState[];
};

/** Whether `state` waits on a yes/no; in markerRuleset only the `then` branch of an `if has` asks one. */
const pausedOnYesNo = (state: TestState): boolean => state.public.pending.some((d) => d.kind === "yesNo");

/** Plays one game with Easy on both sides (playEasy checks every answer), recording what the tests need. */
function playMarkerGame(seed: number, into: Played): void {
  const setIn = new Map<string, number>();
  const final = playEasy(markerRuleset, newMarkerGame(seed), EASY_WEIGHTS, seededRandom(seed), {
    name: `game ${seed}`,
    applied: (before, state, events) => {
      into.events.push(...events);
      for (const label of state.public.markers) if (!setIn.has(label)) setIn.set(label, before.public.turn);
      if (state.public.markers.length === 0) return;
      into.marked.push(state);
      const latest = Math.max(...state.public.markers.map((label) => setIn.get(label)!));
      if (pausedOnYesNo(state) && state.public.turn > latest) into.pausedLater.push(state);
    },
  });
  into.finals.push(final);
}

let cached: Played | null = null;
/** The 50 seeded games, played once and shared by the tests below. */
function played(): Played {
  if (cached !== null) return cached;
  const into: Played = { finals: [], events: [], marked: [], pausedLater: [] };
  for (let seed = 1; seed <= GAMES; seed++) playMarkerGame(seed, into);
  cached = into;
  return into;
}

const markerLabels = (events: readonly GameEvent[]): Set<string> =>
  new Set(events.flatMap((e) => (e.kind === "marker" ? [e.label] : [])));

describe("Easy with lasting markers and has conditions", () => {
  it("the marker ruleset's games are accepted by createGame", () => {
    for (let seed = 1; seed <= GAMES; seed++) expect(newMarkerGame(seed).public.status.kind).toBe("active");
  });

  it("plays 50 seeded games on both sides with only legal answers, and every game ends", () => {
    const { finals } = played();
    expect(finals).toHaveLength(GAMES);
    for (const final of finals) expect(final.public.status.kind).toBe("over");
  });

  it("answers the yes/no behind has for both labels: each label's -then and -else markers are recorded", () => {
    const recorded = markerLabels(played().events);
    for (const label of MARKER_LABELS) {
      expect(recorded).toContain(`${label}-then`);
      expect(recorded).toContain(`${label}-else`);
    }
  });

  it("at least one game ends with a non-empty markers list", () => {
    expect(played().finals.some((final) => final.public.markers.length > 0)).toBe(true);
  });

  it("rebuilds states with markers, paused ones included, with the real public part, own private part and meta", () => {
    const { marked, pausedLater } = played();
    expect(marked.length).toBeGreaterThan(0);
    expect(pausedLater.length).toBeGreaterThan(0);
    for (const [i, state] of marked.entries()) {
      for (const side of SIDES) {
        const view = viewFor(state, side);
        const rebuilt = reconstruct(view, guessHidden(markerRuleset, view, side, seededRandom(i + 1)));
        expect(rebuilt.public).toEqual(state.public);
        expect(rebuilt.public.markers).toEqual(state.public.markers);
        expect(rebuilt.private[side]).toEqual(state.private[side]);
        expect(rebuilt.meta).toEqual(state.meta);
      }
    }
  });

  it("with markers set, gives the same answer for the same view and the same random sequence", () => {
    const { pausedLater } = played();
    for (const [i, state] of pausedLater.slice(0, 20).entries()) {
      for (const side of SIDES.filter((s) => state.public.pending.some((d) => d.side === s))) {
        const view = viewFor(state, side);
        const first = easyAnswer(markerRuleset, view, side, EASY_WEIGHTS, seededRandom(i + 5));
        const second = easyAnswer(markerRuleset, view, side, EASY_WEIGHTS, seededRandom(i + 5));
        expect(first).not.toBeNull();
        expect(second).toEqual(first);
      }
    }
  });
});
