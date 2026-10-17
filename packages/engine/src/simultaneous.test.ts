import { describe, expect, it } from "vitest";
import { apply, hiddenPart, pendingFor, reconstruct, SIDES, viewFor } from "./index.ts";
import type { GameState, PlayerView, Side, Step, Viewer } from "./index.ts";
import { startProgram } from "./stack.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  accepted,
  answerYesNo,
  cardAnswer,
  choose,
  ifSaid,
  ifYes,
  marker,
  markers,
  ruleset,
  startGame,
  startWith,
  yesNoAnswer,
} from "./test/game.ts";

const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");
const code = (r: ReturnType<typeof apply>) => (r.ok ? "ok" : r.error.code);

// "Both sides choose yes or no; then mark both answers; then LIO chooses yes or no."
// The last choice keeps the program paused, so its frame and variables can be inspected.
const pairThenWait: Step[] = [choose("v", "both"), marker("v", "v"), choose("after")];
const paused = (): GameState => deepFreeze(startWith(pairThenWait).state);

/** A view with the two places a half answer may change, meta.seq and public.pending, set aside. */
const setAside = (v: PlayerView) => ({ ...v, meta: { ...v.meta, seq: 0 }, public: { ...v.public, pending: [] } });

describe("simultaneous decisions: a choose step with who 'both' opens a pair", () => {
  it("one yesNo decision per side, in SIDES order, sharing a new simultaneousGroup", () => {
    const s = paused();
    const [lio, sae] = s.public.pending;
    expect(s.public.pending.map((d) => d.side)).toEqual(["lio", "sae"]);
    expect([lio?.kind, sae?.kind]).toEqual(["yesNo", "yesNo"]);
    expect(lio?.simultaneousGroup).toEqual(expect.any(String));
    expect(sae?.simultaneousGroup).toBe(lio?.simultaneousGroup);
    expect(lio?.id).not.toBe(sae?.id);
    expect(lio?.simultaneousGroup).not.toBe(startGame().public.pending[0]?.simultaneousGroup);
  });
  it("while both are open, pendingFor returns each side its own decision", () => {
    const s = paused();
    for (const side of SIDES) expect(pendingFor(s, side)).toMatchObject({ side, kind: "yesNo" });
  });
});

describe("simultaneous decisions: the first answer stays secret", () => {
  it("is stored in the answering side's private compartment as its unrevealed pick", () => {
    for (const side of SIDES) {
      const s = paused();
      const answer = yesNoAnswer(s, true, side);
      const half = accepted(s, answer);
      const group = s.public.pending[0]?.simultaneousGroup;
      expect(half.private[side].picks).toEqual([
        { group, decisionId: "decisionId" in answer && answer.decisionId, value: { kind: "yesNo", yes: true } },
      ]);
      expect(half.private[other(side)].picks).toEqual([]);
    }
  });
  it("that side's own view shows its pick; the other side's view and the spectator view do not", () => {
    for (const side of SIDES) {
      const half = accepted(paused(), yesNoAnswer(paused(), false, side));
      expect(viewFor(half, side).mine?.picks).toEqual([
        expect.objectContaining({ value: { kind: "yesNo", yes: false } }),
      ]);
      expect(JSON.stringify(viewFor(half, side))).toContain('"yes":false');
      for (const viewer of [other(side), "spectator"] as const) {
        expect(JSON.stringify(viewFor(half, viewer))).not.toContain('"yes":');
      }
    }
  });
  it("that side's pendingFor becomes null; the other side still has its decision", () => {
    for (const side of SIDES) {
      const s = paused();
      const half = accepted(s, yesNoAnswer(s, true, side));
      expect(pendingFor(half, side)).toBeNull();
      expect(pendingFor(half, other(side))).toEqual(pendingFor(s, other(side)));
    }
  });
  it("the other side's and the spectator's views change only in meta.seq and that side's decision leaving public.pending", () => {
    for (const side of SIDES) {
      for (const yes of [true, false]) {
        const s = paused();
        const half = accepted(s, yesNoAnswer(s, yes, side));
        for (const viewer of [other(side), "spectator"] as Viewer[]) {
          const before = viewFor(s, viewer);
          const after = viewFor(half, viewer);
          expect(setAside(after)).toEqual(setAside(before));
          expect(after.meta.seq).toBe(before.meta.seq + 1);
          expect(after.public.pending).toEqual(before.public.pending.filter((d) => d.side !== side));
        }
        expect(half.private[other(side)]).toEqual(s.private[other(side)]);
      }
    }
  });
  it("returns no events", () => {
    const s = paused();
    const r = apply(ruleset, s, yesNoAnswer(s, true, "sae"));
    expect(r.ok && r.value.events).toEqual([]);
  });
  it("hiddenPart carries the other side's unrevealed pick, and reconstruct rebuilds the state exactly", () => {
    const half = deepFreeze(accepted(paused(), yesNoAnswer(paused(), true, "lio")));
    expect(hiddenPart(half, "sae").opponent.picks).toEqual(half.private.lio.picks);
    for (const side of SIDES) expect(reconstruct(viewFor(half, side), hiddenPart(half, side))).toStrictEqual(half);
  });
});

describe("simultaneous decisions: answering again", () => {
  it("answering again in the same group returns alreadyAnswered and changes nothing", () => {
    for (const side of SIDES) {
      const s = paused();
      const first = yesNoAnswer(s, true, side);
      const half = deepFreeze(accepted(s, first));
      const before = JSON.stringify(half);
      for (const yes of [true, false]) {
        const again = { ...first, value: { kind: "yesNo", yes } } as typeof first;
        expect(code(apply(ruleset, half, again))).toBe("alreadyAnswered");
      }
      expect(JSON.stringify(half)).toBe(before);
    }
  });
});

describe("simultaneous decisions: the reveal", () => {
  it("binds the variable in the frame to both answers keyed by side, in SIDES order, whatever the arrival order", () => {
    for (const order of [SIDES, [...SIDES].reverse()]) {
      let s = paused();
      for (const side of order) s = accepted(s, yesNoAnswer(s, side === "lio", side));
      const program = s.public.stack[0];
      expect(program?.vars).toEqual([{ name: "v", value: { lio: true, sae: false } }]);
      expect(JSON.stringify(program?.vars)).toBe('[{"name":"v","value":{"lio":true,"sae":false}}]');
    }
  });
  it("clears both private picks, and the program runs on to its next choice", () => {
    let s = paused();
    s = accepted(s, yesNoAnswer(s, true, "sae"));
    s = accepted(s, yesNoAnswer(s, false, "lio"));
    expect(s.private.lio.picks).toEqual([]);
    expect(s.private.sae.picks).toEqual([]);
    expect(s.public.pending).toEqual([{ id: expect.any(String), side: "lio", kind: "yesNo", options: {} }]);
  });
  it("the second answer returns the events of the steps that follow, with both answers in SIDES order", () => {
    const s = paused();
    const half = accepted(s, yesNoAnswer(s, false, "sae"));
    const r = apply(ruleset, half, yesNoAnswer(half, true, "lio"));
    expect(r.ok && r.value.events).toEqual([
      { kind: "marker", visibility: "public", label: "v", value: { lio: true, sae: false } },
    ]);
  });
  it("both sides choose; if LIO said yes, marker lio-yes, otherwise lio-no; then the same for SAE: right markers for all four combinations", () => {
    const program = [
      choose("v", "both"),
      ifSaid("lio", "v", [marker("lio-yes")], [marker("lio-no")]),
      ifSaid("sae", "v", [marker("sae-yes")], [marker("sae-no")]),
    ];
    for (const lio of [true, false]) {
      for (const sae of [true, false]) {
        for (const first of SIDES) {
          const yes = { lio, sae };
          const half = answerYesNo(startWith(program).state, yes[first], ruleset, first).state;
          const { events } = answerYesNo(half, yes[other(first)], ruleset, other(first));
          expect(markers(events)).toEqual([lio ? "lio-yes" : "lio-no", sae ? "sae-yes" : "sae-no"]);
        }
      }
    }
  });
  it("an if on a both-sides answer must name a side, and an if on a one-side answer must not", () => {
    const bothNoSide = [choose("v", "both"), ifYes("v", [marker("m")])];
    let s = startWith(bothNoSide).state;
    s = accepted(s, yesNoAnswer(s, true, "lio"));
    expect(code(apply(ruleset, s, yesNoAnswer(s, true, "sae")))).toBe("invalidProgram");
    const oneWithSide = [choose("v", "lio"), ifSaid("lio", "v", [marker("m")])];
    const one = startWith(oneWithSide).state;
    expect(code(apply(ruleset, one, yesNoAnswer(one, true)))).toBe("invalidProgram");
  });
});

describe("simultaneous decisions: resigning and starting programs", () => {
  it("resigning while a group is open ends the game, before or after one side has answered", () => {
    const open = paused();
    for (const s of [open, accepted(open, yesNoAnswer(open, true, "lio"))]) {
      for (const side of SIDES) {
        const r = apply(ruleset, s, { system: "resign", side });
        expect(r.ok && r.value.state.public.status).toEqual({ kind: "over", winner: other(side), reason: "resigned" });
        expect(r.ok && r.value.state.public.pending).toEqual([]);
        expect(r.ok && r.value.state.public.stack).toEqual([]);
        expect(r.ok && SIDES.map((x) => r.value.state.private[x].picks)).toEqual([[], []]);
      }
    }
  });
  it("a program cannot start while a group is half answered", () => {
    const half = deepFreeze(accepted(startGame(), cardAnswer(startGame(), "sae")));
    expect(startProgram(ruleset, half, [marker("m")])).toMatchObject({ ok: false, error: { code: "notSupported" } });
  });
});
