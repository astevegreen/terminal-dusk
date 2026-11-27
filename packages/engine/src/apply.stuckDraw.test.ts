// A draw on time when the host cannot move for a late side (owner, 26 Nov 2026, in chat: "Draw on time"; #629):
// under the "defaultAnswer" deadline rule the host's stand-in found no answer for the side named in `stuck`.
// The engine checks only that the named side has a decision waiting, as it does for a loss on time.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Answer, GameState, Side } from "./index.ts";
import { otherSide } from "./types.ts";
import { accepted, cardAnswer, ruleset, startAtPlay, startGame } from "./test/game.ts";

const code = (r: ReturnType<typeof apply>) => (r.ok ? "ok" : r.error.code);
const stuckDraw = (stuck: Side): Answer => ({ system: "timeout", side: "both", stuck });

function expectDraw(s: GameState, stuck: Side): void {
  const r = apply(ruleset, s, stuckDraw(stuck));
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
  const next = r.value.state;
  expect(next.public.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
  expect(next.meta.seq).toBe(s.meta.seq + 1);
  expect(next.public.pending).toEqual([]);
  expect(next.public.stack).toEqual([]);
  expect(next.private.lio.picks).toEqual([]);
  expect(next.private.sae.picks).toEqual([]);
  expect(r.value.events).toEqual([]);
}

function expectRefused(s: GameState, answer: Answer): void {
  const before = JSON.stringify(s);
  expect(code(apply(ruleset, s, answer))).toBe("wrongSide");
  expect(JSON.stringify(s)).toBe(before);
}

describe("apply: a draw on time when the host cannot move for the late side", () => {
  it("the named stuck side has a decision waiting and the other has none: a draw on time", () => {
    const s = startAtPlay();
    expect(s.public.pending).toHaveLength(1);
    expectDraw(s, s.public.pending[0]!.side);
  });

  it("the opening pick with one half made: naming the side still to pick is a draw on time", () => {
    const s = accepted(startGame(), cardAnswer(startGame(), "lio"));
    expectDraw(s, "sae");
  });

  it("the named stuck side has nothing waiting: refused with wrongSide, state unchanged", () => {
    const s = startAtPlay();
    expectRefused(s, stuckDraw(otherSide(s.public.pending[0]!.side)));
    expectRefused(accepted(startGame(), cardAnswer(startGame(), "lio")), stuckDraw("lio"));
  });

  it("`stuck` that is not a side: refused with wrongSide, state unchanged", () => {
    const s = startAtPlay();
    for (const stuck of ["both", "x", null, 1]) {
      expectRefused(s, { system: "timeout", side: "both", stuck } as unknown as Answer);
    }
  });

  it("a stray `stuck` on a one-side timeout changes nothing: still a loss on time", () => {
    const s = startAtPlay();
    const late = s.public.pending[0]!.side;
    const r = apply(ruleset, s, { system: "timeout", side: late, stuck: otherSide(late) } as unknown as Answer);
    expect(r.ok && r.value.state.public.status).toEqual({ kind: "over", winner: otherSide(late), reason: "timeout" });
  });
});
