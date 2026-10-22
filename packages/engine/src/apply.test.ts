import { describe, expect, it } from "vitest";
import { apply } from "./apply.ts";
import type { Answer, GameState } from "./index.ts";
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
  it("adjudicate returns notSupported", () => {
    for (const side of ["lio", "sae"] as const) {
      expect(code(apply(ruleset, s, { system: "adjudicate", side }))).toBe("notSupported");
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
  it("never changes deep-frozen inputs, including the Contingency decks, and carries the decks over unchanged", () => {
    const s = deepFreeze(startGame());
    expect(Object.isFrozen(s.public.contingency.lio.left)).toBe(true);
    expect(Object.isFrozen(s.secret.contingency.sae)).toBe(true);
    const r = apply(ruleset, s, deepFreeze(cardAnswer(s, "lio")));
    if (!r.ok) throw new Error(`answer rejected: ${r.error.code}`);
    expect(r.value.state.public.contingency).toEqual(s.public.contingency);
    expect(r.value.state.secret.contingency).toEqual(s.secret.contingency);
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

describe("apply: both sides time out on a simultaneous pick", () => {
  const both: Answer = { system: "timeout", side: "both" };
  const refusedUnchanged = (s: GameState, expected: string): void => {
    const before = JSON.stringify(s);
    expect(code(apply(ruleset, s, both))).toBe(expected);
    expect(JSON.stringify(s)).toBe(before);
  };

  it("neither side has picked: the game ends in a draw on time, cleared as a one-side timeout is", () => {
    const s = startGame();
    expect(s.public.pending.map((d) => d.side)).toEqual(["lio", "sae"]);
    const r = apply(ruleset, s, both);
    if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
    const next = r.value.state;
    expect(next.public.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(next.meta.seq).toBe(s.meta.seq + 1);
    expect(next.public.pending).toEqual([]);
    expect(next.public.stack).toEqual([]);
    expect(next.private.lio.picks).toEqual([]);
    expect(next.private.sae.picks).toEqual([]);
    expect(r.value.events).toEqual([]);
    const oneSide = accepted(s, { system: "timeout", side: "lio" });
    expect({ ...next.public, status: null }).toEqual({ ...oneSide.public, status: null });
    expect(next.private).toEqual(oneSide.private);
    expect(next.meta).toEqual(oneSide.meta);
  });
  it("one side has already picked: refused with wrongSide and the state is unchanged", () => {
    refusedUnchanged(accepted(startGame(), cardAnswer(startGame(), "lio")), "wrongSide");
  });
  it("a game waiting on one side only: refused with wrongSide and the state is unchanged", () => {
    const s = startAtPlay();
    expect(s.public.pending).toHaveLength(1);
    refusedUnchanged(s, "wrongSide");
  });
  it("two pending decisions that are not one simultaneous pick: refused with wrongSide and the state is unchanged", () => {
    const s = startGame();
    const regrouped = (group: (i: number) => string | undefined): GameState => ({
      ...s,
      public: {
        ...s.public,
        pending: s.public.pending.map((d, i) => {
          const { simultaneousGroup: _dropped, ...rest } = d;
          const g = group(i);
          return g === undefined ? rest : { ...rest, simultaneousGroup: g };
        }),
      },
    });
    refusedUnchanged(
      regrouped(() => undefined),
      "wrongSide",
    );
    refusedUnchanged(
      regrouped((i) => `group-${i}`),
      "wrongSide",
    );
  });
  it("a finished game: refused with gameOver and the state is unchanged", () => {
    const over = playAnswers(startAtPlay(1), 2);
    expect(over.public.status.kind).toBe("over");
    refusedUnchanged(over, "gameOver");
  });
  it("resign and adjudicate still name one side only", () => {
    for (const system of ["resign", "adjudicate"] as const) {
      const a = { system, side: "both" } as unknown as Answer;
      expect(code(apply(ruleset, startGame(), a))).toBe("unknownDecision");
    }
  });
  it("never changes deep-frozen inputs", () => {
    const r = apply(deepFreeze({ ...ruleset }), deepFreeze(startGame()), deepFreeze({ ...both }));
    expect(r.ok).toBe(true);
  });
});
