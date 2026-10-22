// Property test: random streams of good and bad answers keep the engine's invariants, and every
// answer gets exactly the outcome the rules call for (accepted, or refused with the right error).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply, legalAnswers, SIDES } from "./index.ts";
import type { Answer, EngineErrorCode, GameState, Ruleset, Side } from "./index.ts";
import { otherSide } from "./types.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { ruleset, startGame } from "./test/game.ts";

const numbers = (v: unknown): number[] =>
  typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(numbers) : [];

type MoveKind =
  | "answer"
  | "again"
  | "wrongSide"
  | "unknownId"
  | "badValue"
  | "resign"
  | "timeout"
  | "timeoutBoth"
  | "adjudicate"
  | "mismatchedRuleset";
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
    "timeoutBoth",
    "adjudicate",
    "mismatchedRuleset",
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
  const value = legal[m.pick % Math.max(legal.length, 1)] ?? { kind: "yesNo", yes: true };
  switch (m.kind) {
    case "answer":
    case "mismatchedRuleset":
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
    case "timeoutBoth":
      return { system: "timeout", side: "both" };
    case "adjudicate":
      return { system: "adjudicate", side: m.side };
  }
}

/** The same ruleset under another id, to apply an otherwise legal answer with the wrong one. */
const otherRuleset: Ruleset = { ...ruleset, id: `${ruleset.id}-other` };

/** JSON with object keys sorted, so equal values match whatever order their keys arrived in. */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    x !== null && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1)))
      : x,
  );

/** True when both sides have an open decision in one simultaneous group (so neither has picked yet). */
const oneOpenPair = (s: GameState): boolean => {
  const groups = SIDES.map((side) => s.public.pending.find((d) => d.side === side)?.simultaneousGroup);
  return groups[0] !== undefined && groups[0] === groups[1];
};

/**
 * What `apply` must give, worked out from the state and the answer alone, in the order apply checks:
 * "ok", or the error code it must refuse with.
 */
function expectedOutcome(rs: Ruleset, s: GameState, a: Answer): "ok" | EngineErrorCode {
  if (rs.id !== s.meta.ruleset) return "rulesetMismatch";
  if (s.public.status.kind === "over") return "gameOver";
  if ("system" in a) {
    if (a.system === "resign") return "ok";
    if (a.system === "timeout" && a.side === "both") return oneOpenPair(s) ? "ok" : "wrongSide";
    if (a.system === "timeout") return s.public.pending.some((d) => d.side === a.side) ? "ok" : "wrongSide";
    return "notSupported";
  }
  const open = s.public.pending.find((d) => d.id === a.decisionId);
  if (!open) {
    return s.private[a.side].picks.some((p) => p.decisionId === a.decisionId) ? "alreadyAnswered" : "unknownDecision";
  }
  if (open.side !== a.side) return "wrongSide";
  return legalAnswers(rs, s, a.side).some((v) => canon(v) === canon(a.value)) ? "ok" : "illegalAnswer";
}

/** Applies one move, checks it got the expected outcome, and returns the state to carry on from. */
function step(s: GameState, m: Move): GameState {
  const answer = deepFreeze(toAnswer(s, m));
  const rs = m.kind === "mismatchedRuleset" ? otherRuleset : ruleset;
  const expected = expectedOutcome(rs, s, answer);
  const before = JSON.stringify(s);
  const r = apply(rs, s, answer);
  expect(JSON.stringify(s)).toBe(before);
  if (expected !== "ok") {
    expect(r).toMatchObject({ ok: false, error: { code: expected } });
    return s;
  }
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
  const next = r.value.state;
  if ("system" in answer) {
    const reason = answer.system === "timeout" ? "timeout" : "resigned";
    const winner = answer.side === "both" ? null : otherSide(answer.side);
    expect(next.public.status).toEqual({ kind: "over", winner, reason });
    expect(next.public.pending).toEqual([]);
    expect(next.public.stack).toEqual([]);
    for (const side of SIDES) expect(next.private[side].picks).toEqual([]);
    expect(r.value.events).toEqual([]);
  }
  expect(next.meta.seq).toBe(s.meta.seq + 1);
  expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  for (const n of numbers(next)) expect(Number.isInteger(n)).toBe(true);
  // Open decisions exist exactly while the game is active, at most one per side, in SIDES order.
  const sides = next.public.pending.map((d) => d.side);
  expect(sides.length > 0).toBe(next.public.status.kind === "active");
  expect(sides).toEqual(SIDES.filter((side) => sides.includes(side)));
  return deepFreeze(next);
}

// Games of 1 to 4 turns with 1 or 2 plays each: the test setup has hands for up to 12 opening cards and plays.
const turnsArb = fc.integer({ min: 1, max: 4 });
const playsArb = fc.integer({ min: 1, max: 2 });

describe("apply: invariants over random answer streams", () => {
  it("every answer gets exactly the expected outcome; accepted ones add 1 to seq; refused ones change nothing; state stays plain integer JSON", () => {
    fc.assert(
      fc.property(turnsArb, playsArb, fc.array(moveArb, { maxLength: 30 }), (turns, plays, moves) => {
        let s = deepFreeze(startGame(turns, plays));
        for (const m of moves) s = step(s, m);
      }),
      { numRuns: 300 },
    );
  });
  it("an unrevealed pick exists only while its pair's other decision is open, and its own side has none in the pair", () => {
    let halfAnswered = 0;
    fc.assert(
      fc.property(turnsArb, playsArb, fc.array(moveArb, { maxLength: 30 }), (turns, plays, moves) => {
        let s = deepFreeze(startGame(turns, plays));
        for (const m of moves) {
          s = step(s, m);
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
