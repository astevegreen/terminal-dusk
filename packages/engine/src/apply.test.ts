import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Answer } from "./index.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import {
  accepted,
  cardAnswer,
  choose,
  playAnswer,
  playAnswers,
  ruleset,
  startAtPlay,
  startGame,
  startWith,
} from "./test/game.ts";

const code = (r: ReturnType<typeof apply>) => (r.ok ? "ok" : r.error.code);

describe("apply: rejected answers", () => {
  const s = startAtPlay();
  it("unknown decision ID", () => {
    const a: Answer = { decisionId: "nope", side: "lio", value: { kind: "playCardAs", card: "l2", as: "event" } };
    expect(code(apply(ruleset, s, a))).toBe("unknownDecision");
  });
  it("wrong side", () => {
    const a: Answer = { ...(cardAnswer(s, "lio") as Extract<Answer, { decisionId: string }>), side: "sae" };
    expect(code(apply(ruleset, s, a))).toBe("wrongSide");
  });
  it("a value not in legalAnswers", () => {
    const a = { ...cardAnswer(s, "lio"), value: { kind: "dance" } } as unknown as Answer;
    expect(code(apply(ruleset, s, a))).toBe("illegalAnswer");
  });
  it("a card that is not in the answering side's hand", () => {
    for (const card of ["s2", "z1", "c99"])
      expect(code(apply(ruleset, s, playAnswer(s, "lio", card, "points")))).toBe("illegalAnswer");
    const opening = startGame();
    expect(code(apply(ruleset, opening, cardAnswer(opening, "lio", "s1")))).toBe("illegalAnswer");
  });
  it("a game that is already over", () => {
    const first = startAtPlay(1);
    const over = playAnswers(first, 2);
    expect(code(apply(ruleset, over, { system: "resign", side: "lio" }))).toBe("gameOver");
    expect(code(apply(ruleset, over, cardAnswer(first, "lio")))).toBe("gameOver");
  });
  it("a ruleset whose id is not the game's", () => {
    expect(code(apply({ ...ruleset, id: "other" }, s, cardAnswer(s, "lio")))).toBe("rulesetMismatch");
  });
  it("a rejected answer leaves the state untouched", () => {
    const before = JSON.stringify(s);
    apply(ruleset, s, { decisionId: "nope", side: "lio", value: { kind: "playCardAs", card: "l2", as: "event" } });
    expect(JSON.stringify(s)).toBe(before);
  });
  it("timeout and adjudicate return notSupported", () => {
    for (const system of ["timeout", "adjudicate"] as const) {
      expect(code(apply(ruleset, s, { system, side: "lio" }))).toBe("notSupported");
    }
  });
  it("malformed answers return an error instead of throwing", () => {
    const junk = [null, undefined, 7, "playCard", {}, { system: "resign", side: "nobody" }];
    for (const a of junk) {
      expect(() => apply(ruleset, s, a as unknown as Answer)).not.toThrow();
      expect(apply(ruleset, s, a as unknown as Answer).ok).toBe(false);
    }
  });
});

describe("apply: accepted answers", () => {
  it("each accepted answer raises meta.seq by exactly 1", () => {
    let s = startGame(3);
    // Opening picks (one half answered, then both), plays, and a new turn's opening.
    for (let i = 0; i < 6; i++) {
      expect(s.meta.seq).toBe(i);
      s = playAnswers(s, 1);
    }
    expect(s.meta.seq).toBe(6);
  });
  it("returns no events", () => {
    const s = startAtPlay();
    const r = apply(ruleset, s, cardAnswer(s, "lio"));
    expect(r.ok && r.value.events).toEqual([]);
  });
  it("never changes deep-frozen inputs", () => {
    const frozenRuleset = deepFreeze({ ...ruleset, cards: ruleset.cards.map((c) => ({ ...c })) });
    for (const s of [deepFreeze(startGame()), deepFreeze(playAnswers(startGame(), 1)), deepFreeze(startAtPlay())]) {
      const d = s.public.pending[0]!;
      const answer = deepFreeze(cardAnswer(s, d.side));
      expect(apply(frozenRuleset, s, answer).ok).toBe(true);
    }
  });
  it("an answer value with its fields in another order is still accepted (JSON stores may reorder keys)", () => {
    const paused = startWith([choose("go")]).state;
    const d = paused.public.pending[0]!;
    const reordered = { decisionId: d.id, side: d.side, value: { yes: true, kind: "yesNo" } } as Answer;
    expect(apply(ruleset, paused, reordered).ok).toBe(true);
    const atPlay = startAtPlay();
    const play = atPlay.public.pending[0]!;
    const value = { as: "points", card: "l2", kind: "playCardAs" };
    const reorderedPlay = { decisionId: play.id, side: play.side, value } as Answer;
    expect(apply(ruleset, atPlay, reorderedPlay).ok).toBe(true);
  });
  it("a yes/no answer with an extra field or a non-boolean yes is illegal", () => {
    const paused = startWith([choose("go")]).state;
    const d = paused.public.pending[0]!;
    const wrong = [
      { kind: "yesNo", yes: true, extra: 1 },
      { kind: "yesNo", yes: "true" },
      { kind: "playCardAs", card: "l2", as: "event" },
    ];
    for (const value of wrong) {
      const a = { decisionId: d.id, side: d.side, value } as unknown as Answer;
      expect(code(apply(ruleset, paused, a))).toBe("illegalAnswer");
    }
  });
  it("state stays plain JSON with integers only", () => {
    const s = playAnswers(startGame(), 3);
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
