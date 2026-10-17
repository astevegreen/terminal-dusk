// Property test: random streams of good and bad answers keep the engine's invariants.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, SIDES } from "./index.ts";
import type { Answer, GameState, Side } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { ruleset, startGame } from "./test/game.ts";

const numbers = (v: unknown): number[] =>
  typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(numbers) : [];

type Move = { kind: "pass" | "wrongSide" | "unknownId" | "badValue" | "resign" | "timeout"; side: Side };
const moveArb: fc.Arbitrary<Move> = fc.record({
  kind: fc.constantFrom("pass", "pass", "pass", "wrongSide", "unknownId", "badValue", "resign", "timeout"),
  side: fc.constantFrom(...SIDES),
});

function toAnswer(s: GameState, m: Move): Answer {
  const d = s.public.pending[0];
  const id = d?.id ?? "none";
  const owner = d?.side ?? m.side;
  const other = SIDES.find((x) => x !== owner)!;
  switch (m.kind) {
    case "pass":
      return { decisionId: id, side: owner, value: { kind: "pass" } };
    case "wrongSide":
      return { decisionId: id, side: other, value: { kind: "pass" } };
    case "unknownId":
      return { decisionId: `${id}-stale`, side: owner, value: { kind: "pass" } };
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
});
