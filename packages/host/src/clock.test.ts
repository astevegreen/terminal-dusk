import { describe, expect, it } from "vitest";
import { hostCreate } from "./hostCreate.ts";
import { hostSubmit } from "./hostSubmit.ts";
import { clockOf, DAY, startedWith, withClock } from "./test/clock.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { makeConfig, NOW, ruleset, SEED } from "./test/match.ts";
import { accept, nextSide, started, submissionFor } from "./test/play.ts";
import type { HostResult, MatchConfig } from "./types.ts";

const createCode = (deadline: unknown): string => {
  const config = { ...makeConfig(), deadline } as unknown as MatchConfig;
  const r = hostCreate(ruleset, config, SEED, NOW);
  return r.ok ? "ok" : r.error.code;
};

describe("hostCreate: a match's deadline setting", () => {
  it("without a deadline the match has no clock and no deadlineAt effect", () => {
    const host = started();
    expect(host.record.clock).toBeUndefined();
    expect("clock" in host.record).toBe(false);
    expect(host.effects.some((e) => "deadlineAt" in e)).toBe(false);
  });

  it("refuses invalidConfig for a deadline with any other rule or days value", () => {
    for (const bad of [
      null,
      "lossOnTime",
      {},
      { rule: "aiPlays", days: 1 },
      { rule: "lossOnTime" },
      { days: 3 },
      { rule: "lossOnTime", days: 2 },
      { rule: "graceThenLoss", days: 5 },
      { rule: "graceThenLoss", days: "1" },
      { rule: "lossOnTime", days: 1.5 },
    ]) {
      expect(createCode(bad), JSON.stringify(bad)).toBe("invalidConfig");
    }
    for (const rule of ["lossOnTime", "graceThenLoss"]) {
      for (const days of [1, 3, 7]) expect(createCode({ rule, days })).toBe("ok");
    }
  });

  for (const days of [1, 3, 7] as const) {
    it(`a ${days}-day deadline gives each waiting side now + ${days} days, with no grace used`, () => {
      const host = startedWith("graceThenLoss", days);
      expect(host.record.clock).toEqual({
        rule: "graceThenLoss",
        days,
        deadlines: { lio: NOW + days * DAY, sae: NOW + days * DAY },
        graceUsed: { lio: false, sae: false },
      });
    });
  }

  it("adds one deadlineAt effect with the earliest deadline, after the notifications", () => {
    const host = startedWith("lossOnTime", 3);
    expect(host.effects).toEqual([{ notify: "alice" }, { notify: "bob" }, { deadlineAt: NOW + 3 * DAY }]);
  });
});

describe("hostSubmit: each side's clock after an accepted answer", () => {
  it("in a simultaneous pick, one side answers and the other side's deadline does not move", () => {
    const first = startedWith("lossOnTime");
    const half = accept(first, submissionFor(first, "lio"), NOW + 5);
    expect(clockOf(half).deadlines).toEqual({ lio: null, sae: NOW + DAY });
    expect(half.effects).toEqual([{ deadlineAt: NOW + DAY }]);
  });

  it("a side that gets a new decision gets a new deadline from now; a side with none gets null", () => {
    const first = startedWith("lossOnTime");
    const half = accept(first, submissionFor(first, "sae"), NOW + 5);
    const both = accept(half, submissionFor(half, "lio"), NOW + 10);
    expect(nextSide(both)).toBe("lio");
    expect(clockOf(both).deadlines).toEqual({ lio: NOW + 10 + DAY, sae: null });
    expect(both.effects).toEqual([{ notify: "alice" }, { deadlineAt: NOW + 10 + DAY }]);
  });

  it("a side answers and gets a new decision, so its deadline restarts", () => {
    let host = startedWith("lossOnTime");
    for (let i = 1; i <= 3; i++) host = accept(host, submissionFor(host, nextSide(host)), NOW + i);
    // SAE's play ends turn 1; both sides then get the turn-2 pick, SAE's included.
    expect(clockOf(host).deadlines).toEqual({ lio: null, sae: NOW + 3 + DAY });
    const next = accept(host, submissionFor(host, "sae"), NOW + 100);
    expect(clockOf(next).deadlines).toEqual({ lio: NOW + 100 + DAY, sae: NOW + 100 + DAY });
  });

  it("a finished game has both deadlines null and no deadlineAt effect", () => {
    let host = startedWith("graceThenLoss");
    let t = NOW;
    while (host.record.status.kind === "active") host = accept(host, submissionFor(host, nextSide(host)), ++t);
    expect(clockOf(host).deadlines).toEqual({ lio: null, sae: null });
    expect(host.effects).toEqual([{ finalize: true }]);
    const resigned = accept(startedWith("lossOnTime"), { player: "bob", resign: true }, NOW + 1);
    expect(clockOf(resigned).deadlines).toEqual({ lio: null, sae: null });
    expect(resigned.effects).toEqual([{ finalize: true }]);
  });

  it("the new clock is a fresh value and the inputs are not changed", () => {
    const first = deepFreeze(startedWith("graceThenLoss"));
    const before = JSON.stringify(first);
    const r = hostSubmit(ruleset, first.record, first.secret, submissionFor(first, "lio"), NOW + 1);
    expect(r.ok).toBe(true);
    expect(JSON.stringify(first)).toBe(before);
    if (r.ok) expect(r.value.record.clock).not.toBe(first.record.clock);
  });
});

describe("hostSubmit: answers sent near the deadline", () => {
  const code = (host: HostResult, now: number, side: "lio" | "sae" = "lio"): string => {
    const r = hostSubmit(ruleset, host.record, host.secret, submissionFor(host, side), now);
    return r.ok ? "ok" : r.error.code;
  };

  it("one millisecond before the deadline the answer is taken and no grace is used, under either rule", () => {
    for (const rule of ["lossOnTime", "graceThenLoss"] as const) {
      const host = startedWith(rule);
      const next = accept(host, submissionFor(host, "lio"), NOW + DAY - 1);
      expect(clockOf(next).graceUsed).toEqual({ lio: false, sae: false });
    }
  });

  it("lossOnTime: an answer exactly at the deadline is refused with pastDeadline and nothing changes", () => {
    const host = deepFreeze(startedWith("lossOnTime"));
    const before = JSON.stringify(host);
    expect(code(host, NOW + DAY)).toBe("pastDeadline");
    expect(code(host, NOW + DAY + 1)).toBe("pastDeadline");
    expect(JSON.stringify(host)).toBe(before);
  });

  it("graceThenLoss with grace left: a late answer is taken and uses that side's extension", () => {
    const host = startedWith("graceThenLoss");
    const next = accept(host, submissionFor(host, "lio"), NOW + DAY);
    expect(clockOf(next).graceUsed).toEqual({ lio: true, sae: false });
    expect(next.secret.log).toHaveLength(1);
  });

  it("graceThenLoss with the grace used: a late answer is refused with pastDeadline", () => {
    const first = startedWith("graceThenLoss");
    const half = accept(first, submissionFor(first, "sae"), NOW + DAY); // SAE uses its grace
    const both = accept(half, submissionFor(half, "lio"), NOW + DAY + 1);
    let host = accept(both, submissionFor(both, "lio"), NOW + DAY + 2); // now SAE plays
    expect(nextSide(host)).toBe("sae");
    const deadline = clockOf(host).deadlines.sae!;
    expect(deadline).toBe(NOW + DAY + 2 + DAY);
    host = deepFreeze(host);
    const before = JSON.stringify(host);
    expect(code(host, deadline, "sae")).toBe("pastDeadline");
    expect(JSON.stringify(host)).toBe(before);
    expect(code(host, deadline - 1, "sae")).toBe("ok");
  });

  it("a late resignation is always taken, even with no grace left", () => {
    const host = deepFreeze(startedWith("lossOnTime"));
    const next = accept(host, { player: "alice", resign: true }, NOW + 5 * DAY);
    expect(next.record.status).toEqual({ kind: "over", winner: "sae", reason: "resigned" });
  });

  it("the pastDeadline check comes after notPlayer, invalidTime, staleSeq and the answer's shape", () => {
    const host = deepFreeze(startedWith("lossOnTime"));
    const s = submissionFor(host, "lio");
    const late = NOW + DAY;
    const send = (body: unknown, now = late): string => {
      const r = hostSubmit(ruleset, host.record, host.secret, body as typeof s, now);
      return r.ok ? "ok" : r.error.code;
    };
    expect(send({ ...s, player: "mallory" })).toBe("notPlayer");
    expect(send(s, NOW - 1)).toBe("invalidTime");
    expect(send({ ...s, expectedSeq: 99 })).toBe("staleSeq");
    expect(send({ ...s, value: null })).toBe("illegalAnswer");
    expect(send(s)).toBe("pastDeadline");
  });

  it("an answer from a side whose deadline has passed is refused only for that side", () => {
    const host = startedWith("lossOnTime");
    const late = withClock(host, { deadlines: { lio: NOW + 5, sae: NOW + DAY } });
    expect(code(late, NOW + 5, "lio")).toBe("pastDeadline");
    expect(code(late, NOW + 5, "sae")).toBe("ok");
  });
});
