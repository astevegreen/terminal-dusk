import { pendingFor } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hostDeadline } from "./hostDeadline.ts";
import { clockOf, DAY, lioToPlay, startedWith, swept, withClock } from "./test/clock.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { NOW, ruleset } from "./test/match.ts";
import { accept, started, submissionFor } from "./test/play.ts";
import type { HostResult } from "./types.ts";

const code = (host: HostResult, now: number): string => {
  const r = hostDeadline(ruleset, host.record, host.secret, now);
  return r.ok ? "ok" : r.error.code;
};

/** LIO's deadline in lioToPlay: it got its play decision at NOW + 2. */
const LIO_DUE = NOW + 2 + DAY;

describe("hostDeadline: refusals", () => {
  it("invalidTime, the same way hostSubmit does", () => {
    const host = deepFreeze(lioToPlay("graceThenLoss"));
    for (const now of [host.record.updatedAt - 1, LIO_DUE + 0.5, Number.NaN]) {
      expect(code(host, now), String(now)).toBe("invalidTime");
    }
  });

  it("gameOver for a finished game", () => {
    const over = accept(startedWith("graceThenLoss"), { player: "alice", resign: true }, NOW + 1);
    expect(code(deepFreeze(over), NOW + 10 * DAY)).toBe("gameOver");
  });

  it("notDue when the match has no clock", () => {
    expect(code(deepFreeze(started()), NOW + 10 * DAY)).toBe("notDue");
  });

  it("notDue one millisecond before the earliest deadline, and not at it", () => {
    const host = deepFreeze(lioToPlay("lossOnTime"));
    expect(code(host, LIO_DUE - 1)).toBe("notDue");
    expect(code(host, LIO_DUE)).toBe("ok");
  });
});

describe("hostDeadline: exactly one side late", () => {
  it("graceThenLoss, grace unused: one extension from now; seq, state and log stay the same", () => {
    const host = lioToPlay("graceThenLoss");
    const now = LIO_DUE + 500;
    const next = swept(host, now);
    expect(next.record).toEqual({
      ...host.record,
      updatedAt: now,
      clock: { ...clockOf(host), deadlines: { lio: now + DAY, sae: null }, graceUsed: { lio: true, sae: false } },
    });
    expect(next.secret).toEqual(host.secret);
    expect(next.effects).toEqual([{ deadlineAt: now + DAY }]);
  });

  it("an extension's frames are rebuilt from the unchanged state with no events", () => {
    const host = lioToPlay("graceThenLoss");
    const next = swept(host, LIO_DUE);
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(next.frames[viewer].seq).toBe(host.record.seq);
      expect(next.frames[viewer].events).toEqual([]);
      expect(next.frames[viewer].view).toEqual(host.frames[viewer].view);
    }
    expect(next.frames.lio.decision).toEqual(pendingFor(host.secret.state, "lio"));
    expect(next.frames.sae.decision).toBeNull();
  });

  it("graceThenLoss, grace used: the second miss is a loss on time and the deadlines become null", () => {
    const extended = swept(lioToPlay("graceThenLoss"), LIO_DUE);
    const due = clockOf(extended).deadlines.lio!;
    expect(code(extended, due - 1)).toBe("notDue");
    const next = swept(extended, due);
    expect(next.record.status).toEqual({ kind: "over", winner: "sae", reason: "timeout" });
    expect(next.record.seq).toBe(extended.record.seq + 1);
    expect(next.secret.log[next.secret.log.length - 1]).toEqual({ system: "timeout", side: "lio" });
    expect(clockOf(next)).toEqual({ ...clockOf(extended), deadlines: { lio: null, sae: null } });
    expect(next.effects).toEqual([{ finalize: true }]);
  });

  it("lossOnTime: the first miss is a loss on time", () => {
    const next = swept(lioToPlay("lossOnTime"), LIO_DUE);
    expect(next.record.status).toEqual({ kind: "over", winner: "sae", reason: "timeout" });
    expect(clockOf(next).deadlines).toEqual({ lio: null, sae: null });
    expect(clockOf(next).graceUsed).toEqual({ lio: false, sae: false });
  });

  it("only the late side is handled while the other side still has time", () => {
    const host = withClock(startedWith("graceThenLoss"), { deadlines: { lio: NOW + 5, sae: NOW + DAY } });
    const next = swept(host, NOW + 5);
    expect(clockOf(next).deadlines).toEqual({ lio: NOW + 5 + DAY, sae: NOW + DAY });
    expect(clockOf(next).graceUsed).toEqual({ lio: true, sae: false });
    expect(next.effects).toEqual([{ deadlineAt: NOW + DAY }]);
  });
});

describe("hostDeadline: both sides late in a simultaneous pick", () => {
  it("both with grace left: both get their extension, with one updatedAt and one deadlineAt effect", () => {
    const host = startedWith("graceThenLoss");
    expect(code(deepFreeze(host), NOW + DAY - 1)).toBe("notDue");
    const next = swept(host, NOW + DAY + 7);
    expect(clockOf(next).deadlines).toEqual({ lio: NOW + DAY + 7 + DAY, sae: NOW + DAY + 7 + DAY });
    expect(clockOf(next).graceUsed).toEqual({ lio: true, sae: true });
    expect(next.record.updatedAt).toBe(NOW + DAY + 7);
    expect(next.record.seq).toBe(host.record.seq);
    expect(next.effects).toEqual([{ deadlineAt: NOW + DAY + 7 + DAY }]);
  });

  it("exactly one with no grace left: that side loses on time", () => {
    for (const side of ["lio", "sae"] as const) {
      const used = { lio: side === "lio", sae: side === "sae" };
      const next = swept(withClock(startedWith("graceThenLoss"), { graceUsed: used }), NOW + DAY);
      expect(next.record.status).toEqual({ kind: "over", winner: side === "lio" ? "sae" : "lio", reason: "timeout" });
    }
  });

  it("neither with grace left: exactly at the later deadline the game ends in a draw on time", () => {
    const extended = swept(startedWith("graceThenLoss"), NOW + DAY);
    const frozen = deepFreeze(extended);
    const before = JSON.stringify(frozen);
    expect(code(frozen, NOW + 2 * DAY - 1)).toBe("notDue");
    expectDraw(frozen, NOW + 2 * DAY);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("neither with grace left, deadlines apart: one millisecond before the later one, the earlier side loses", () => {
    const host = withClock(startedWith("graceThenLoss"), {
      deadlines: { lio: NOW + 5, sae: NOW + 9 },
      graceUsed: { lio: true, sae: true },
    });
    const early = swept(host, NOW + 8);
    expect(early.record.status).toEqual({ kind: "over", winner: "sae", reason: "timeout" });
    expectDraw(deepFreeze(host), NOW + 9);
  });

  it("lossOnTime: exactly at the deadline the game ends in a draw on time", () => {
    const host = deepFreeze(startedWith("lossOnTime"));
    expect(code(host, NOW + DAY - 1)).toBe("notDue");
    expectDraw(host, NOW + DAY);
  });
});

/** Checks the sweep at `now` ends `host` as a draw on time through a both-sides timeout. */
function expectDraw(host: HostResult, now: number): void {
  const next = swept(host, now);
  expect(next.record.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
  expect(next.record.seq).toBe(host.record.seq + 1);
  expect(next.secret.log).toEqual([...host.secret.log, { system: "timeout", side: "both" }]);
  expect(clockOf(next).deadlines).toEqual({ lio: null, sae: null });
  expect(clockOf(next).graceUsed).toEqual(clockOf(host).graceUsed);
  expect(next.record.seed).toBeDefined();
  expect(next.effects).toEqual([{ finalize: true }]);
}

describe("hostDeadline: a late answer and the sweep reach the same clock", () => {
  it("the late answer alone, or after the extension was saved, both leave graceUsed true", () => {
    const host = lioToPlay("graceThenLoss");
    const submission = submissionFor(host, "lio");
    const answeredFirst = accept(host, submission, LIO_DUE + 1);
    const extended = swept(host, LIO_DUE);
    const answeredAfter = accept(extended, submission, LIO_DUE + 1);
    expect(clockOf(answeredFirst)).toEqual(clockOf(answeredAfter));
    expect(clockOf(answeredFirst).graceUsed.lio).toBe(true);
    expect(answeredFirst.secret).toEqual(answeredAfter.secret);
  });
});

describe("hostDeadline: safety", () => {
  it("never throws and never changes its inputs, even with a damaged clock", () => {
    const base = lioToPlay("graceThenLoss");
    const damaged: unknown[] = [
      null,
      "clock",
      { rule: "graceThenLoss", days: 1 },
      { ...clockOf(base), deadlines: null },
      { ...clockOf(base), deadlines: { lio: "soon", sae: null } },
      { ...clockOf(base), graceUsed: { lio: 1, sae: false } },
      { ...clockOf(base), rule: "other" },
    ];
    for (const clock of damaged) {
      const host = deepFreeze({ ...base, record: { ...base.record, clock } } as HostResult);
      const before = JSON.stringify(host);
      expect(() => hostDeadline(ruleset, host.record, host.secret, LIO_DUE)).not.toThrow();
      expect(code(host, LIO_DUE)).toBe("notDue");
      expect(JSON.stringify(host)).toBe(before);
    }
    const host = deepFreeze(lioToPlay("graceThenLoss"));
    const before = JSON.stringify(host);
    for (const now of [LIO_DUE - 1, LIO_DUE, LIO_DUE + 10 * DAY]) hostDeadline(ruleset, host.record, host.secret, now);
    expect(JSON.stringify(host)).toBe(before);
  });
});
