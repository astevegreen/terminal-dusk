// A timeout ends the game as a loss on time for the side that was late (architecture Decision 1, "System actions").
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Answer, GameState, Side } from "./index.ts";
import { otherSide } from "./types.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { accepted, cardAnswer, playAnswers, ruleset, startAtPlay, startGame } from "./test/game.ts";

const code = (r: ReturnType<typeof apply>) => (r.ok ? "ok" : r.error.code);
const timeout = (side: Side): Answer => ({ system: "timeout", side });

/** Checks a timeout for `side` ends `s` as a loss on time, cleared exactly as a resignation is. */
function expectLossOnTime(s: GameState, side: Side): void {
  const r = apply(ruleset, s, timeout(side));
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
  const next = r.value.state;
  expect(next.public.status).toEqual({ kind: "over", winner: otherSide(side), reason: "timeout" });
  expect(next.meta.seq).toBe(s.meta.seq + 1);
  expect(next.public.pending).toEqual([]);
  expect(next.public.stack).toEqual([]);
  expect(next.private.lio.picks).toEqual([]);
  expect(next.private.sae.picks).toEqual([]);
  expect(r.value.events).toEqual([]);
}

describe("apply: timeout", () => {
  it("a timeout for the side with a pending decision ends the game as a loss on time", () => {
    const s = startAtPlay();
    expectLossOnTime(s, s.public.pending[0]!.side);
  });
  it("the timeout clears pending, stack and picks exactly as a resignation does", () => {
    const s = startAtPlay();
    const late = s.public.pending[0]!.side;
    const resigned = accepted(s, { system: "resign", side: late });
    const timedOut = accepted(s, timeout(late));
    expect({ ...timedOut.public, status: null }).toEqual({ ...resigned.public, status: null });
    expect(timedOut.private).toEqual(resigned.private);
    expect(timedOut.meta).toEqual(resigned.meta);
  });
  it("a late side in a simultaneous choice loses on time when neither side has picked", () => {
    const s = startGame();
    expect(s.public.pending.map((d) => d.side)).toEqual(["lio", "sae"]);
    expectLossOnTime(s, "lio");
    expectLossOnTime(s, "sae");
  });
  it("a late side in a simultaneous choice loses on time after the other side has picked", () => {
    const s = accepted(startGame(), cardAnswer(startGame(), "lio"));
    expect(s.private.lio.picks).toHaveLength(1);
    expectLossOnTime(s, "sae");
  });
  it("a timeout for a side with no pending decision is refused with wrongSide and changes nothing", () => {
    const picked = accepted(startGame(), cardAnswer(startGame(), "lio"));
    const s = startAtPlay();
    const idle = otherSide(s.public.pending[0]!.side);
    expect(s.public.pending.some((d) => d.side === idle)).toBe(false);
    for (const [state, side] of [
      [picked, "lio"],
      [s, idle],
    ] as const) {
      const before = JSON.stringify(state);
      expect(code(apply(ruleset, state, timeout(side)))).toBe("wrongSide");
      expect(JSON.stringify(state)).toBe(before);
    }
  });
  it("a timeout on a finished game is refused with gameOver", () => {
    const over = playAnswers(startAtPlay(1), 2);
    expect(over.public.status.kind).toBe("over");
    expect(code(apply(ruleset, over, timeout("lio")))).toBe("gameOver");
    expect(code(apply(ruleset, over, timeout("sae")))).toBe("gameOver");
  });
  it("never changes deep-frozen inputs", () => {
    const s = deepFreeze(startGame());
    const r = apply(deepFreeze({ ...ruleset }), s, deepFreeze(timeout("lio")));
    expect(r.ok).toBe(true);
  });
});
