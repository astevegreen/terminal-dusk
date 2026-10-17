// Property test: random streams of good and bad answers keep the engine's invariants.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, legalAnswers, SIDES } from "./index.ts";
import type { Answer, GameState, Side } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { ruleset, startGame } from "./test/game.ts";

const numbers = (v: unknown): number[] =>
  typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(numbers) : [];
const otherSide = (side: Side): Side => SIDES.find((x) => x !== side)!;

type MoveKind = "answer" | "again" | "wrongSide" | "unknownId" | "badValue" | "resign" | "timeout";
/** `pick` chooses which open decision to answer and which of its legal answers to give. */
type Move = { kind: MoveKind; side: Side; pick: number };
const moveArb: fc.Arbitrary<Move> = fc.record({
  kind: fc.constantFrom<MoveKind>(
    "answer",
    "answer",
    "answer",
    "again",
    "wrongSide",
    "unknownId",
    "badValue",
    "resign",
    "timeout",
  ),
  side: fc.constantFrom(...SIDES),
  pick: fc.nat(),
});

function toAnswer(s: GameState, m: Move): Answer {
  const open = s.public.pending;
  const d = open[m.pick % Math.max(open.length, 1)];
  const id = d?.id ?? "none";
  const owner = d?.side ?? m.side;
  const legal = legalAnswers(ruleset, s, owner);
  const value = legal[m.pick % Math.max(legal.length, 1)] ?? { kind: "pass" };
  switch (m.kind) {
    case "answer":
      return { decisionId: id, side: owner, value };
    case "again": {
      // Answer again the decision this side already picked in an open pair, if it has one.
      const pick = s.private[m.side].picks[0];
      return pick
        ? { decisionId: pick.decisionId, side: m.side, value: pick.value }
        : { decisionId: id, side: owner, value };
    }
    case "wrongSide":
      return { decisionId: id, side: otherSide(owner), value };
    case "unknownId":
      return { decisionId: `${id}-stale`, side: owner, value };
    case "badValue":
      return { decisionId: id, side: owner, value: { kind: "nope" } } as unknown as Answer;
    case "resign":
      return { system: "resign", side: m.side };
    case "timeout":
      return { system: "timeout", side: m.side };
  }
}

describe("apply: invariants over random answer streams", () => {
  it("accepted answers add exactly 1 to seq; rejected ones change nothing; state stays plain integer JSON", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.array(moveArb, { maxLength: 30 }), (rounds, moves) => {
        let s = deepFreeze(startGame(rounds));
        for (const m of moves) {
          const before = JSON.stringify(s);
          const r = apply(ruleset, s, deepFreeze(toAnswer(s, m)));
          expect(JSON.stringify(s)).toBe(before);
          if (m.kind === "again" && s.private[m.side].picks.length > 0) {
            expect(r).toMatchObject({ ok: false, error: { code: "alreadyAnswered" } });
          }
          if (!r.ok) continue;
          const next = r.value.state;
          expect(next.meta.seq).toBe(s.meta.seq + 1);
          expect(JSON.parse(JSON.stringify(next))).toEqual(next);
          for (const n of numbers(next)) expect(Number.isInteger(n)).toBe(true);
          // Open decisions exist exactly while the game is active, at most one per side, in SIDES order.
          const sides = next.public.pending.map((d) => d.side);
          expect(sides.length > 0).toBe(next.public.status.kind === "active");
          expect(sides).toEqual(SIDES.filter((side) => sides.includes(side)));
          s = deepFreeze(next);
        }
      }),
      { numRuns: 300 },
    );
  });
  it("an unrevealed pick exists only while its pair's other decision is open, and its own side has none in the pair", () => {
    let halfAnswered = 0;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.array(moveArb, { maxLength: 30 }), (rounds, moves) => {
        let s = deepFreeze(startGame(rounds));
        for (const m of moves) {
          const r = apply(ruleset, s, toAnswer(s, m));
          if (!r.ok) continue;
          s = deepFreeze(r.value.state);
          for (const side of SIDES) {
            expect(s.private[side].picks.length).toBeLessThanOrEqual(1);
            for (const pick of s.private[side].picks) {
              halfAnswered += 1;
              const pair = s.public.pending.filter((d) => d.simultaneousGroup === pick.group);
              expect(pair.map((d) => d.side)).toEqual([otherSide(side)]);
            }
          }
        }
      }),
      { numRuns: 300 },
    );
    expect(halfAnswered).toBeGreaterThan(50);
  });
});
