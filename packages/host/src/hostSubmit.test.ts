import { SIDES } from "@terminal-dusk/engine";
import type { Answer, Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hostSubmit } from "./hostSubmit.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { NOW, ruleset } from "./test/match.ts";
import { accept, nextSide, started, submissionFor } from "./test/play.ts";
import type { HostResult, Submission } from "./types.ts";

const code = (host: HostResult, submission: unknown, now = NOW, rules = ruleset): string => {
  const r = hostSubmit(rules, host.record, host.secret, submission as Submission, now);
  return r.ok ? "ok" : r.error.code;
};

/** Plays the whole test game with first-choice answers; returns every step. */
function playToEnd(): { steps: HostResult[]; answers: Submission[] } {
  const steps = [started()];
  const answers: Submission[] = [];
  while (steps[steps.length - 1]!.record.status.kind === "active") {
    const host = steps[steps.length - 1]!;
    const submission = submissionFor(host, nextSide(host));
    answers.push(submission);
    steps.push(accept(host, submission, NOW + steps.length));
  }
  return { steps, answers };
}

describe("hostSubmit: a short game played to its end", () => {
  it("seq rises by exactly one per accepted answer, and the log holds every accepted answer in order", () => {
    const { steps, answers } = playToEnd();
    expect(answers).toHaveLength(8);
    steps.forEach((step, i) => {
      expect(step.record.seq).toBe(i);
      expect(step.secret.log).toHaveLength(i);
    });
    const last = steps[steps.length - 1]!;
    expect(last.secret.log.map((a) => ("decisionId" in a ? a.decisionId : a.system))).toEqual(
      answers.map((a) => ("decisionId" in a ? a.decisionId : "")),
    );
    expect(last.secret.log.map((a) => a.side)).toEqual(
      answers.map((a) => SIDES.find((s) => last.record.players[s] === a.player)),
    );
  });

  it("the record and secret follow the new state, updatedAt is now and createdAt is unchanged", () => {
    const first = started();
    const next = accept(first, submissionFor(first, "lio"), NOW + 5);
    expect(next.record).toEqual({
      ...first.record,
      seq: next.secret.state.meta.seq,
      status: next.secret.state.public.status,
      updatedAt: NOW + 5,
    });
    expect(next.record.createdAt).toBe(first.record.createdAt);
    expect(next.secret.seed).toBe(first.secret.seed);
    expect(next.secret.setup).toEqual(first.secret.setup);
  });

  it("the engine answer in the log names the side looked up from record.players", () => {
    const first = started();
    const submission = submissionFor(first, "sae");
    const next = accept(first, submission);
    if (!("decisionId" in submission)) throw new Error("expected an answer");
    const expected: Answer[] = [{ decisionId: submission.decisionId, side: "sae", value: submission.value }];
    expect(next.secret.log).toEqual(expected);
  });

  it("each frame carries the new seq and only this answer's events", () => {
    const { steps } = playToEnd();
    steps.forEach((step, i) => {
      for (const viewer of ["lio", "sae", "spectator"] as const) expect(step.frames[viewer].seq).toBe(i);
    });
    // Only the answer that ends the turn (the fourth) has an event; later frames do not repeat it.
    const counts = steps.map((s) => s.frames.spectator.events.length);
    expect(counts).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(steps[4]!.frames.lio.events).toEqual(steps[4]!.frames.spectator.events);
  });
});

describe("hostSubmit: refusals leave the inputs unchanged", () => {
  const frozen = () => {
    const host = started();
    deepFreeze(ruleset);
    return { host: deepFreeze(host), before: JSON.stringify(host) };
  };

  it("notPlayer: the player is not one of record.players", () => {
    const { host, before } = frozen();
    const s = submissionFor(host, "lio");
    expect(code(host, { ...s, player: "mallory" })).toBe("notPlayer");
    expect(code(host, { player: "mallory", resign: true })).toBe("notPlayer");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("invalidTime: now is not a whole number, or is earlier than record.updatedAt", () => {
    const { host, before } = frozen();
    const s = submissionFor(host, "lio");
    for (const now of [NOW + 0.5, Number.NaN, NOW - 1, "9" as unknown as number]) {
      expect(code(host, s, now), String(now)).toBe("invalidTime");
    }
    expect(code(host, s, NOW)).toBe("ok");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("staleSeq: an expectedSeq that is not record.seq", () => {
    const { host, before } = frozen();
    const s = submissionFor(host, "lio") as Extract<Submission, { expectedSeq: number }>;
    expect(code(host, { ...s, expectedSeq: s.expectedSeq + 1 })).toBe("staleSeq");
    expect(code(host, { ...s, expectedSeq: s.expectedSeq - 1 })).toBe("staleSeq");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("staleSeq: an answer sent without expectedSeq, or with one that is not a whole number", () => {
    const { host, before } = frozen();
    const noSeq: Record<string, unknown> = { ...submissionFor(host, "lio") };
    delete noSeq.expectedSeq;
    expect(code(host, noSeq)).toBe("staleSeq");
    expect(code(host, { ...noSeq, expectedSeq: "0" })).toBe("staleSeq");
    expect(code(host, { ...noSeq, expectedSeq: host.record.seq + 0.5 })).toBe("staleSeq");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("an answer with a matching expectedSeq and decisionId but no value is refused, not thrown", () => {
    const { host, before } = frozen();
    const noValue: Record<string, unknown> = { ...submissionFor(host, "lio") };
    delete noValue.value;
    expect(() => hostSubmit(ruleset, host.record, host.secret, noValue as unknown as Submission, NOW)).not.toThrow();
    expect(code(host, noValue)).toBe("illegalAnswer");
    expect(code(host, { ...noValue, value: null })).toBe("illegalAnswer");
    expect(code(host, { ...noValue, decisionId: undefined, value: {} })).toBe("illegalAnswer");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("a submission with resign: false is not a resignation", () => {
    const { host, before } = frozen();
    expect(code(host, { player: "alice", resign: false })).toBe("staleSeq");
    expect(JSON.stringify(host)).toBe(before);
    const s = submissionFor(host, "lio");
    expect(code(host, { ...s, resign: false })).toBe("ok");
  });

  it("the host's checks run in the order notPlayer, invalidTime, staleSeq", () => {
    const { host } = frozen();
    const s = { ...submissionFor(host, "lio"), expectedSeq: 99 } as Submission;
    expect(code(host, { ...s, player: "mallory" }, NOW - 1)).toBe("notPlayer");
    expect(code(host, s, NOW - 1)).toBe("invalidTime");
    expect(code(host, s)).toBe("staleSeq");
  });

  it("rulesetMismatch: a ruleset whose id is not record.ruleset", () => {
    const { host, before } = frozen();
    expect(code(host, submissionFor(host, "lio"), NOW, { ...ruleset, id: "other" })).toBe("rulesetMismatch");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("unknownDecision: no open decision has that id", () => {
    const { host, before } = frozen();
    expect(code(host, { ...submissionFor(host, "lio"), decisionId: "nope" })).toBe("unknownDecision");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("wrongSide: the decision belongs to the other side", () => {
    const { host, before } = frozen();
    const s = submissionFor(host, "sae") as Extract<Submission, { decisionId: string }>;
    expect(code(host, { ...s, player: host.record.players.lio })).toBe("wrongSide");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("alreadyAnswered: a side answers its simultaneous choice a second time", () => {
    const first = started();
    const half = accept(first, submissionFor(first, "lio"));
    const again = { ...submissionFor(first, "lio"), expectedSeq: half.record.seq };
    deepFreeze(half);
    const before = JSON.stringify(half);
    expect(code(half, again, NOW)).toBe("alreadyAnswered");
    expect(JSON.stringify(half)).toBe(before);
  });

  it("illegalAnswer: an answer that is not among the legal ones", () => {
    const { host, before } = frozen();
    const s = submissionFor(host, "lio");
    expect(code(host, { ...s, value: { kind: "chooseCard", card: "n1" } })).toBe("illegalAnswer");
    expect(code(host, { ...s, value: { kind: "yesNo", yes: true } })).toBe("illegalAnswer");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("gameOver: any answer to a finished game that is not stale", () => {
    const { steps } = playToEnd();
    const over = deepFreeze(steps[steps.length - 1]!);
    expect(code(over, { player: "alice", resign: true }, over.record.updatedAt)).toBe("gameOver");
    const fake = {
      player: "alice",
      expectedSeq: over.record.seq,
      decisionId: "d0-lio",
      value: { kind: "yesNo", yes: true },
    };
    expect(code(over, fake, over.record.updatedAt)).toBe("gameOver");
  });
});

describe("hostSubmit: an answer sent twice", () => {
  it("is accepted once and refused the second time with staleSeq, changing nothing", () => {
    const first = started();
    const submission = submissionFor(first, "lio");
    const half = deepFreeze(accept(first, submission));
    const before = JSON.stringify(half);
    expect(code(half, submission)).toBe("staleSeq");
    expect(JSON.stringify(half)).toBe(before);
  });

  it("the move that ends the game, sent twice, is refused with staleSeq, not gameOver", () => {
    const { steps, answers } = playToEnd();
    const over = deepFreeze(steps[steps.length - 1]!);
    expect(over.record.status.kind).toBe("over");
    expect(code(over, answers[answers.length - 1], over.record.updatedAt)).toBe("staleSeq");
  });
});

describe("hostSubmit: resigning", () => {
  for (const side of SIDES) {
    it(`${side} resigns: the status is over, the other side wins and every frame's decision is null`, () => {
      const host = started();
      const other: Side = side === "lio" ? "sae" : "lio";
      const next = accept(host, { player: host.record.players[side], resign: true }, NOW + 1);
      expect(next.record.status).toEqual({ kind: "over", winner: other, reason: "resigned" });
      expect(next.record.seq).toBe(host.record.seq + 1);
      expect(next.secret.log).toEqual([{ system: "resign", side }]);
      for (const viewer of ["lio", "sae", "spectator"] as const) expect(next.frames[viewer].decision).toBeNull();
      expect(next.effects).toEqual([]);
    });
  }

  it("a player may resign mid-game, needing no expectedSeq", () => {
    const host = started();
    const half = accept(host, submissionFor(host, "lio"));
    const next = accept(half, { player: "bob", resign: true });
    expect(next.record.status).toMatchObject({ kind: "over", winner: "lio" });
  });

  it("a second resignation is refused with gameOver, changing nothing", () => {
    const host = started();
    const over = deepFreeze(accept(host, { player: "alice", resign: true }));
    expect(code(over, { player: "bob", resign: true }, over.record.updatedAt)).toBe("gameOver");
  });
});

describe("hostSubmit: notify effects", () => {
  it("notifies each side that gets a decision it did not have before, in SIDES order, and not a side still waiting", () => {
    const steps = playToEnd().steps;
    // 0 start: both wait. 1 lio picks: sae still waits (no notify). 2 sae picks: lio plays. 3 lio plays: sae plays.
    expect(steps[0]!.effects).toEqual([{ notify: "alice" }, { notify: "bob" }]);
    expect(steps[1]!.effects).toEqual([]);
    expect(steps[2]!.effects).toEqual([{ notify: "alice" }]);
    expect(steps[3]!.effects).toEqual([{ notify: "bob" }]);
    expect(steps[4]!.effects).toEqual([{ notify: "alice" }, { notify: "bob" }]);
    expect(steps[8]!.effects).toEqual([]);
  });

  it("sae picking first leaves lio waiting without a second notification", () => {
    const first = started();
    const half = accept(first, submissionFor(first, "sae"));
    expect(half.effects).toEqual([]);
    expect(accept(half, submissionFor(half, "lio")).effects).toEqual([{ notify: "alice" }]);
  });
});

describe("hostSubmit: equal inputs give equal results", () => {
  it("two calls with the same frozen inputs return equal outcomes", () => {
    const host = deepFreeze(started());
    const submission = deepFreeze(submissionFor(host, "lio"));
    expect(hostSubmit(ruleset, host.record, host.secret, submission, NOW)).toEqual(
      hostSubmit(ruleset, host.record, host.secret, submission, NOW),
    );
  });
});
