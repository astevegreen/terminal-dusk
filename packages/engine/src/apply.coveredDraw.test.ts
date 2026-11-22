// A draw on time the host vouches for (#605, owner 22 Nov 2026: "Yes, a draw"): under the "defaultAnswer" deadline
// rule the host played for one side earlier this turn, that side has nothing waiting, and the other side is late.
// The host names the covered side in `covered`; without it a "both" timeout is only the missed simultaneous pick.
import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Answer, GameState, Side } from "./index.ts";
import { otherSide } from "./types.ts";
import { accepted, cardAnswer, ruleset, startAtPlay, startGame } from "./test/game.ts";

const code = (r: ReturnType<typeof apply>) => (r.ok ? "ok" : r.error.code);
const drawFor = (covered: Side): Answer => ({ system: "timeout", side: "both", covered });

function expectDraw(s: GameState, covered: Side): void {
  const r = apply(ruleset, s, drawFor(covered));
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

describe("apply: a draw on time with a covered side", () => {
  it("one side waits to play, the named covered side has nothing waiting: a draw on time", () => {
    const s = startAtPlay();
    expect(s.public.pending).toHaveLength(1);
    expectDraw(s, otherSide(s.public.pending[0]!.side));
  });

  it("the opening pick with one half made: naming the side that picked is a draw on time", () => {
    const s = accepted(startGame(), cardAnswer(startGame(), "lio"));
    expectDraw(s, "lio");
  });

  it("the named covered side still has a decision waiting: refused with wrongSide, state unchanged", () => {
    const s = startAtPlay();
    expectRefused(s, drawFor(s.public.pending[0]!.side));
    expectRefused(accepted(startGame(), cardAnswer(startGame(), "lio")), drawFor("sae"));
  });

  it("`covered` that is not a side: refused with wrongSide, state unchanged", () => {
    const s = startAtPlay();
    for (const covered of ["both", "x", null, 1]) {
      expectRefused(s, { system: "timeout", side: "both", covered } as unknown as Answer);
    }
  });

  it("neither side waiting: refused with wrongSide, whichever side is named", () => {
    const s = startAtPlay();
    const idle: GameState = { ...s, public: { ...s.public, pending: [] } };
    expectRefused(idle, drawFor("lio"));
    expectRefused(idle, drawFor("sae"));
  });

  it("a covered side on a one-side timeout or a resignation changes nothing about them", () => {
    const s = startAtPlay();
    const late = s.public.pending[0]!.side;
    const r = apply(ruleset, s, { system: "timeout", side: late, covered: otherSide(late) } as unknown as Answer);
    expect(r.ok && r.value.state.public.status).toEqual({ kind: "over", winner: otherSide(late), reason: "timeout" });
  });
});
