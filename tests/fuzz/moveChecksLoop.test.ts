// Every fuzz game runs the own-moves check (#696): the game loop in play.ts calls checkOwnMoves on each applied
// answer, so the extraSteps, reactions and map suites check it too, not only moveChecks.test.ts's own games.
// Here the engine's apply is wrapped so that, once `wrongSide` is set, the first placement it reports is relabelled
// as the other side's: the loop must stop on that step, while unwrapped games still pass.
import type { GameEvent, Side } from "@terminal-dusk/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { playGame, randomChooser, randomGame, ruleset } from "./play.ts";
import { seededRng } from "./random.ts";
import { onTestMap } from "./testMap.ts";

const stub = vi.hoisted(() => ({ wrongSide: false }));

vi.mock("@terminal-dusk/engine", async (importOriginal) => {
  const engine = await importOriginal<typeof import("@terminal-dusk/engine")>();
  const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");
  const relabel = (events: readonly GameEvent[]): GameEvent[] => {
    const at = events.findIndex((event) => event.kind === "influencePlaced");
    if (at < 0) return [...events];
    stub.wrongSide = false;
    return events.map((event, i) =>
      i === at && event.kind === "influencePlaced" ? { ...event, side: other(event.side) } : event,
    );
  };
  return {
    ...engine,
    apply: (...args: Parameters<typeof engine.apply>) => {
      const result = engine.apply(...args);
      if (!stub.wrongSide || !result.ok) return result;
      return { ...result, value: { ...result.value, events: relabel(result.value.events) } };
    },
  };
});

afterEach(() => {
  stub.wrongSide = false;
});

/** A random game on the test map, so influence gets placed. */
function mapGame(game: number): () => unknown {
  const rng = seededRng(game);
  const { setup, seed } = randomGame(rng, game);
  return () => playGame(ruleset, `own-moves game ${game}`, onTestMap(setup), seed, randomChooser(ruleset, rng));
}

describe("the fuzz game loop", () => {
  it("throws when an answer's events carry the other side's move", () => {
    // Games whose first placement comes late enough still hit it: try a few until one places influence.
    let report: string | null = null;
    for (let game = 0; game < 20 && report === null; game++) {
      stub.wrongSide = true;
      try {
        mapGame(game)();
      } catch (err) {
        report = String(err);
      }
    }
    expect(report).toMatch(/influencePlaced is (lio|sae)'s move, but the answer was (lio|sae)'s/);
  });

  it("passes the same games when every move is the mover's own", () => {
    for (let game = 0; game < 20; game++) expect(mapGame(game)).not.toThrow();
  });
});
