import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Answer } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { accepted, passFor, playPasses, ruleset, startGame } from "./test/game.ts";

const code = (r: ReturnType<typeof apply>) => (r.ok ? "ok" : r.error.code);

describe("apply: rejected answers", () => {
  const s = startGame();
  it("unknown decision ID", () => {
    const a: Answer = { decisionId: "nope", side: "lio", value: { kind: "pass" } };
    expect(code(apply(ruleset, s, a))).toBe("unknownDecision");
  });
  it("wrong side", () => {
    const a: Answer = { ...(passFor(s, "lio") as Extract<Answer, { decisionId: string }>), side: "sae" };
    expect(code(apply(ruleset, s, a))).toBe("wrongSide");
  });
  it("a value not in legalAnswers", () => {
    const a = { ...passFor(s, "lio"), value: { kind: "dance" } } as unknown as Answer;
    expect(code(apply(ruleset, s, a))).toBe("illegalAnswer");
  });
  it("a game that is already over", () => {
    const first = startGame(1);
    const over = playPasses(first, 2);
    expect(code(apply(ruleset, over, { system: "resign", side: "lio" }))).toBe("gameOver");
    expect(code(apply(ruleset, over, passFor(first, "lio")))).toBe("gameOver");
  });
  it("a ruleset whose id is not the game's", () => {
    expect(code(apply({ id: "other" }, s, passFor(s, "lio")))).toBe("rulesetMismatch");
  });
  it("a rejected answer leaves the state untouched", () => {
    const before = JSON.stringify(s);
    apply(ruleset, s, { decisionId: "nope", side: "lio", value: { kind: "pass" } });
    expect(JSON.stringify(s)).toBe(before);
  });
  it("timeout and adjudicate return notSupported", () => {
    for (const system of ["timeout", "adjudicate"] as const) {
      expect(code(apply(ruleset, s, { system, side: "lio" }))).toBe("notSupported");
    }
  });
  it("malformed answers return an error instead of throwing", () => {
    const junk = [null, undefined, 7, "pass", {}, { system: "resign", side: "nobody" }];
    for (const a of junk) {
      expect(() => apply(ruleset, s, a as unknown as Answer)).not.toThrow();
      expect(apply(ruleset, s, a as unknown as Answer).ok).toBe(false);
    }
  });
});

describe("apply: accepted answers", () => {
  it("each accepted answer raises meta.seq by exactly 1", () => {
    let s = startGame(3);
    for (let i = 0; i < 6; i++) {
      expect(s.meta.seq).toBe(i);
      s = playPasses(s, 1);
    }
    expect(s.meta.seq).toBe(6);
  });
  it("returns no events", () => {
    const s = startGame();
    const r = apply(ruleset, s, passFor(s, "lio"));
    expect(r.ok && r.value.events).toEqual([]);
  });
  it("never changes deep-frozen inputs", () => {
    const s = deepFreeze(startGame());
    const answer = deepFreeze(passFor(s, "lio"));
    expect(apply(deepFreeze({ ...ruleset }), s, answer).ok).toBe(true);
  });
  it("state stays plain JSON with integers only", () => {
    const s = playPasses(startGame(), 3);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect(Number.isInteger(s.public.turn) && Number.isInteger(s.meta.seq)).toBe(true);
  });
});

describe("apply: resign", () => {
  it("never changes deep-frozen inputs", () => {
    const s = deepFreeze(startGame());
    const r = apply(deepFreeze({ ...ruleset }), s, deepFreeze({ system: "resign", side: "lio" } as Answer));
    expect(r.ok).toBe(true);
  });
  it("ends the game with the other side as winner", () => {
    for (const [side, winner] of [
      ["lio", "sae"],
      ["sae", "lio"],
    ] as const) {
      const r = apply(ruleset, startGame(), { system: "resign", side });
      expect(r.ok && r.value.state.public.status).toEqual({ kind: "over", winner, reason: "resigned" });
      expect(r.ok && r.value.state.public.pending).toEqual([]);
      expect(r.ok && r.value.state.meta.seq).toBe(1);
    }
  });
  it("after the game is over does not change the result", () => {
    const over = accepted(startGame(), { system: "resign", side: "lio" });
    expect(apply(ruleset, over, { system: "resign", side: "sae" })).toMatchObject({
      ok: false,
      error: { code: "gameOver" },
    });
    expect(over.public.status).toMatchObject({ winner: "sae" });
  });
});
