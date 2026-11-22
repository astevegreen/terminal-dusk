// The third deadline rule, "defaultAnswer" (option C of docs/proposals/missed-turn-ai.md, #605): a late side's
// decisions are answered by the host with the default answer for the rest of that turn.
import { pendingFor } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { nextClock, startClock, validClock, validDeadline } from "./clock.ts";
import { defaultAnswer } from "./defaultAnswer.ts";
import { hostDeadline } from "./hostDeadline.ts";
import { hostSubmit } from "./hostSubmit.ts";
import { clockOf, DAY, lioToPlay, startedWith, swept, withClock } from "./test/clock.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { NOW, ruleset } from "./test/match.ts";
import { accept, submissionFor } from "./test/play.ts";
import { leaksFor } from "./test/secretLeaks.ts";
import type { HostResult, MatchClock } from "./types.ts";

/** LIO's deadline in lioToPlay: it got its play decision at NOW + 2. */
const LIO_DUE = NOW + 2 + DAY;
const turnOf = (host: HostResult): number => host.secret.state.public.turn;

describe("defaultAnswer rule: the setting", () => {
  it("is a valid deadline rule with 1, 3 or 7 days, and starts with no side covered", () => {
    expect(validDeadline({ rule: "defaultAnswer", days: 3 })).toBe(true);
    const host = startedWith("defaultAnswer");
    expect(clockOf(host).covering).toEqual({ lio: null, sae: null });
    expect(startClock({ rule: "lossOnTime", days: 1 }, host.secret.state, NOW).covering).toBeUndefined();
  });

  it("a stored clock without `covering` is still valid; a damaged one is not", () => {
    const old: Partial<MatchClock> = { ...clockOf(startedWith("defaultAnswer")) };
    delete old.covering;
    expect(validClock(old)).toBe(true);
    for (const covering of [null, "x", { lio: "1", sae: null }, { lio: 1.5, sae: null }, { lio: null }]) {
      expect(validClock({ ...old, covering }), JSON.stringify(covering)).toBe(false);
    }
  });

  it("is never combined with the grace extension: a late answer is refused with pastDeadline", () => {
    const host = lioToPlay("defaultAnswer");
    const r = hostSubmit(ruleset, host.record, host.secret, submissionFor(host, "lio"), LIO_DUE);
    expect(r.ok ? "ok" : r.error.code).toBe("pastDeadline");
  });
});

describe("defaultAnswer rule: one side late", () => {
  it("the host answers the late side with the default answer until its turn's decisions are done", () => {
    const host = deepFreeze(lioToPlay("defaultAnswer"));
    const before = JSON.stringify(host);
    const next = swept(host, LIO_DUE);
    expect(JSON.stringify(host)).toBe(before);
    expect(next.record.status.kind).toBe("active");
    expect(next.record.seq).toBeGreaterThan(host.record.seq);
    const added = next.secret.log.slice(host.secret.log.length);
    expect(added).toHaveLength(next.record.seq - host.record.seq);
    expect(added.every((a) => "decisionId" in a && a.side === "lio")).toBe(true);
    const first = added[0] as { decisionId: string; value: unknown };
    expect(first.decisionId).toBe(pendingFor(host.secret.state, "lio")!.id);
    expect(first.value).toEqual(defaultAnswer(ruleset, host.secret.state, "lio"));
    const sameTurn = turnOf(next) === turnOf(host);
    expect(sameTurn ? pendingFor(next.secret.state, "lio") : "turn rose").toBe(sameTurn ? null : "turn rose");
    expect(clockOf(next).covering).toEqual({ lio: sameTurn ? turnOf(host) : null, sae: null });
  });

  it("every frame of a stand-in step is marked with the covered side; ordinary frames are not", () => {
    const host = lioToPlay("defaultAnswer");
    expect(host.frames.lio.standIn).toBeUndefined();
    const next = swept(host, LIO_DUE);
    for (const viewer of ["lio", "sae", "spectator"] as const) expect(next.frames[viewer].standIn).toBe("lio");
    expect(next.frames.sae.events.length).toBeGreaterThan(0);
  });

  it("while covered, the player's own answers that turn are refused with pastDeadline; a resignation is taken", () => {
    const host = lioToPlay("defaultAnswer");
    const covered = withClock(host, { covering: { lio: turnOf(host), sae: null } });
    const r = hostSubmit(ruleset, covered.record, covered.secret, submissionFor(covered, "lio"), NOW + 3);
    expect(r.ok ? "ok" : r.error.code).toBe("pastDeadline");
    const resigned = hostSubmit(ruleset, covered.record, covered.secret, { player: "alice", resign: true }, NOW + 3);
    expect(resigned.ok).toBe(true);
  });

  it("a covered mark from an earlier turn no longer covers: the player answers again", () => {
    const host = lioToPlay("defaultAnswer");
    const old = withClock(host, { covering: { lio: turnOf(host) - 1, sae: null } });
    expect(hostSubmit(ruleset, old.record, old.secret, submissionFor(old, "lio"), NOW + 3).ok).toBe(true);
  });
});

describe("defaultAnswer rule: the clock after a move", () => {
  it("a covered side given a new decision in the same turn is due at once; a new turn clears the mark", () => {
    const { before, after } = lioStepSameTurn();
    const clock = { ...clockOf(before), covering: { lio: turnOf(before), sae: null } };
    const next = nextClock(clock, before.secret.state, after.secret.state, NOW + 50, null);
    expect(next.deadlines.lio).toBe(NOW + 50);
    expect(next.covering).toEqual({ lio: turnOf(before), sae: null });
    const later = { ...after.secret.state, public: { ...after.secret.state.public, turn: turnOf(before) + 1 } };
    const fresh = nextClock(clock, before.secret.state, later, NOW + 50, null);
    expect(fresh.deadlines.lio).toBe(NOW + 50 + DAY);
    expect(fresh.covering).toEqual({ lio: null, sae: null });
  });
});

describe("defaultAnswer rule: both sides late", () => {
  it("both freshly late at once (the opening pick): the game ends in a draw on time", () => {
    const next = swept(deepFreeze(startedWith("defaultAnswer")), NOW + DAY);
    expect(next.record.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(next.secret.log[next.secret.log.length - 1]).toEqual({ system: "timeout", side: "both" });
  });

  it("one side already covered and due again while the other is late too: a draw on time", () => {
    const host = startedWith("defaultAnswer");
    const covered = withClock(host, { covering: { lio: turnOf(host), sae: null } });
    const next = swept(deepFreeze(covered), NOW + DAY);
    expect(next.record.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
  });

  it("a side covered earlier this turn with nothing waiting: the other side's lapse is answered, not drawn", () => {
    // Owner question raised on #605: a draw here needs an engine change; until then the stand-in answers.
    const host = lioToPlay("defaultAnswer");
    expect(pendingFor(host.secret.state, "sae")).toBeNull();
    const covered = withClock(host, { covering: { lio: null, sae: turnOf(host) } });
    const next = swept(covered, LIO_DUE);
    expect(next.record.status.kind).toBe("active");
    expect(next.frames.spectator.standIn).toBe("lio");
  });

  it("a side covered in an earlier turn does not make a later lapse a draw", () => {
    const host = lioToPlay("defaultAnswer");
    const old = withClock(host, { covering: { lio: null, sae: turnOf(host) - 1 } });
    const next = swept(old, LIO_DUE);
    expect(next.record.status.kind).toBe("active");
    expect(next.frames.spectator.standIn).toBe("lio");
  });
});

describe("defaultAnswer rule: a whole game with one absent player", () => {
  it("SAE plays, LIO never answers: the game runs to its end, and no step leaks anything hidden", () => {
    let host = startedWith("defaultAnswer");
    host = accept(host, submissionFor(host, "sae"), NOW + 1);
    let now = NOW + 1;
    for (let step = 0; host.record.status.kind === "active"; step++) {
      expect(step).toBeLessThan(2_000);
      if (pendingFor(host.secret.state, "sae") !== null && !lateNow(host, "lio", now)) {
        now += 1;
        host = accept(host, submissionFor(host, "sae"), now);
      } else {
        now = Math.max(now, clockOf(host).deadlines.lio ?? now);
        host = swept(host, now);
        expect(host.frames.sae.standIn).toBe("lio");
      }
      const over = host.record.status.kind === "over";
      const record = over ? { ...host.record, seed: undefined } : host.record; // the seed is revealed at the end
      expect(leaksFor(JSON.stringify(record), host.secret, "spectator")).toEqual([]);
      for (const viewer of ["lio", "sae", "spectator"] as const) {
        expect(leaksFor(JSON.stringify(host.frames[viewer]), host.secret, viewer), viewer).toEqual([]);
      }
    }
    expect(host.record.status.kind).toBe("over");
  });
});

describe("defaultAnswer rule: refusals", () => {
  it("notDue before the deadline, and never throws on a damaged covering mark", () => {
    const host = deepFreeze(lioToPlay("defaultAnswer"));
    const r = hostDeadline(ruleset, host.record, host.secret, LIO_DUE - 1);
    expect(r.ok ? "ok" : r.error.code).toBe("notDue");
    const damaged = deepFreeze(withClock(host, { covering: "x" as unknown as Record<Side, number | null> }));
    const refused = hostDeadline(ruleset, damaged.record, damaged.secret, LIO_DUE);
    expect(refused.ok ? "ok" : refused.error.code).toBe("notDue");
  });
});

/** True when `side`'s deadline is at or before `now`. */
function lateNow(host: HostResult, side: Side, now: number): boolean {
  const at = clockOf(host).deadlines[side];
  return at !== null && at <= now;
}

/** SAE's opening pick, after LIO's, gives LIO a new decision in the same turn. */
function lioStepSameTurn(): { before: HostResult; after: HostResult } {
  const start = startedWith("defaultAnswer");
  const before = accept(start, submissionFor(start, "lio"), NOW + 1);
  const after = accept(before, submissionFor(before, "sae"), NOW + 2);
  if (pendingFor(before.secret.state, "lio") !== null || pendingFor(after.secret.state, "lio") === null) {
    throw new Error("expected LIO to wait only after SAE's pick");
  }
  if (turnOf(after) !== turnOf(before)) throw new Error("expected the same turn");
  return { before, after };
}
