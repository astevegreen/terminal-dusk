import { SIDES } from "@terminal-dusk/engine";
import type { Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hostArchive } from "./hostArchive.ts";
import { checkFinished } from "./hostFinish.ts";
import { hostSubmit } from "./hostSubmit.ts";
import { hostTimeout } from "./hostTimeout.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { NOW, ruleset, SEED } from "./test/match.ts";
import { accept, nextSide, started, submissionFor } from "./test/play.ts";
import type { HostResult, Submission } from "./types.ts";

const other = (side: Side): Side => (side === "lio" ? "sae" : "lio");

function timedOut(host: HostResult, side: Side | "both", now = NOW + 10): HostResult {
  const r = hostTimeout(ruleset, host.record, host.secret, side, now);
  if (!r.ok) throw new Error(`hostTimeout failed: ${r.error.code}`);
  return r.value;
}

const code = (host: HostResult, side: Side | "both", now = NOW + 10): string => {
  const r = hostTimeout(ruleset, host.record, host.secret, side, now);
  return r.ok ? "ok" : r.error.code;
};

/** Three moves into the test game: both opening picks and LIO's first play, so SAE is the one waited for. */
function midGame(): HostResult {
  let host = started();
  for (let i = 1; i <= 3; i++) host = accept(host, submissionFor(host, nextSide(host)), NOW + i);
  return host;
}

describe("hostTimeout: a loss on time", () => {
  it("on success the record shows the loss on time, seq and updatedAt move on and the seed is published", () => {
    const host = midGame();
    const late = nextSide(host);
    const next = timedOut(host, late, NOW + 50);
    expect(next.record.status).toEqual({ kind: "over", winner: other(late), reason: "timeout" });
    expect(next.record.seq).toBe(host.record.seq + 1);
    expect(next.record.updatedAt).toBe(NOW + 50);
    expect(next.record.seed).toBe(SEED);
    expect(host.record.seed).toBeUndefined();
  });

  it("frames are rebuilt for every viewer, the timeout is appended to the move log and the effects finalize", () => {
    const host = midGame();
    const late = nextSide(host);
    const next = timedOut(host, late);
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(next.frames[viewer].seq).toBe(next.record.seq);
      expect(next.frames[viewer].decision).toBeNull();
      expect(next.frames[viewer].view.public.status).toEqual(next.record.status);
    }
    expect(next.secret.log).toEqual([...host.secret.log, { system: "timeout", side: late }]);
    expect(next.effects).toEqual([{ finalize: true }]);
  });

  it("the finished game passes checkFinished and the replay archive builds from it", () => {
    const next = timedOut(midGame(), "sae");
    expect(checkFinished(ruleset, next.secret, next.secret.log, next.secret.state)).toBeNull();
    const archive = hostArchive(ruleset, next.record, next.secret);
    expect(archive.ok).toBe(true);
    if (!archive.ok) return;
    expect(archive.value.status).toEqual({ kind: "over", winner: "lio", reason: "timeout" });
    expect(archive.value.frames).toHaveLength(next.secret.log.length + 1);
  });

  for (const side of SIDES) {
    it(`${side} times out on the opening simultaneous pick`, () => {
      const next = timedOut(started(), side);
      expect(next.record.status).toEqual({ kind: "over", winner: other(side), reason: "timeout" });
    });
  }
});

/** A few moves in, at the next simultaneous pick with neither side having picked yet. */
function atLaterPair(): HostResult {
  let host = midGame();
  for (let i = 4; i < 40 && !bothWaiting(host); i++) host = accept(host, submissionFor(host, nextSide(host)), NOW + i);
  if (!bothWaiting(host)) throw new Error("the test game never reached a second simultaneous pick");
  return host;
}

const bothWaiting = (host: HostResult): boolean =>
  host.record.status.kind === "active" && SIDES.every((s) => host.frames[s].decision !== null);

describe("hostTimeout: both sides late is a draw", () => {
  it("the record shows the draw on time, seq and updatedAt move on and the seed is published", () => {
    const host = atLaterPair();
    expect(host.secret.log.length).toBeGreaterThan(3);
    const next = timedOut(host, "both", host.record.updatedAt + 50);
    expect(next.record.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(next.record.seq).toBe(host.record.seq + 1);
    expect(next.record.updatedAt).toBe(host.record.updatedAt + 50);
    expect(next.record.seed).toBe(SEED);
  });

  it("the move log gets the both-sides timeout, frames are rebuilt and the effects finalize", () => {
    const host = atLaterPair();
    const next = timedOut(host, "both", host.record.updatedAt);
    expect(next.secret.log).toEqual([...host.secret.log, { system: "timeout", side: "both" }]);
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      expect(next.frames[viewer].decision).toBeNull();
      expect(next.frames[viewer].view.public.status).toEqual(next.record.status);
    }
    expect(next.effects).toEqual([{ finalize: true }]);
  });

  it("the draw passes checkFinished and the replay archive builds from it", () => {
    const host = atLaterPair();
    const next = timedOut(host, "both", host.record.updatedAt);
    expect(checkFinished(ruleset, next.secret, next.secret.log, next.secret.state)).toBeNull();
    const archive = hostArchive(ruleset, next.record, next.secret);
    expect(archive.ok).toBe(true);
    if (!archive.ok) return;
    expect(archive.value.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(archive.value.frames).toHaveLength(next.secret.log.length + 1);
  });

  it("refused with wrongSide when only one side is being waited for", () => {
    const host = deepFreeze(midGame());
    expect(code(host, "both")).toBe("wrongSide");
  });
});

describe("hostTimeout: refusals", () => {
  it("refuses invalidTime the same way hostSubmit does", () => {
    const host = deepFreeze(midGame());
    const late = nextSide(host);
    for (const now of [host.record.updatedAt - 1, 1.5, Number.NaN]) {
      expect(code(host, late, now)).toBe("invalidTime");
      const s = submissionFor(host, late);
      expect(hostSubmit(ruleset, host.record, host.secret, s, now)).toMatchObject({ error: { code: "invalidTime" } });
    }
  });

  it("passes engine refusals through with the engine's code", () => {
    const host = deepFreeze(midGame());
    expect(code(host, other(nextSide(host)))).toBe("wrongSide");
    const over = deepFreeze(timedOut(host, nextSide(host)));
    expect(code(over, "lio", over.record.updatedAt)).toBe("gameOver");
  });

  it("never throws and never changes its inputs", () => {
    const host = deepFreeze(midGame());
    const before = JSON.stringify(host);
    for (const side of [...SIDES, "both" as const, "nobody" as Side]) {
      expect(() => hostTimeout(ruleset, host.record, host.secret, side, NOW + 10)).not.toThrow();
    }
    expect(code(host, "nobody" as Side)).not.toBe("ok");
    expect(JSON.stringify(host)).toBe(before);
  });
});

describe("hostSubmit: a player cannot send a timeout", () => {
  it("a body that tries to be a timeout is refused and nothing ends the game", () => {
    const host = deepFreeze(midGame());
    const bodies = [
      { player: "alice", system: "timeout" },
      { player: "alice", system: "timeout", side: "sae" },
      { player: "bob", timeout: true },
      { player: "bob", timeout: true, side: "lio" },
      { player: "alice", expectedSeq: host.record.seq, system: "timeout", side: "sae" },
      { player: "bob", expectedSeq: host.record.seq, timeout: true },
    ];
    expectRefused(host, bodies);
  });

  it("a body that tries to be a both-sides timeout is refused, without and with a matching expectedSeq", () => {
    const host = deepFreeze(atLaterPair());
    const seq = host.record.seq;
    expectRefused(host, [
      { player: "alice", system: "timeout", side: "both" },
      { player: "bob", system: "timeout", side: "both" },
      { player: "alice", expectedSeq: seq, system: "timeout", side: "both" },
      { player: "bob", expectedSeq: seq, system: "timeout", side: "both" },
    ]);
  });
});

/** Every body is refused with staleSeq or illegalAnswer, and the game is still active and unchanged. */
function expectRefused(host: HostResult, bodies: object[]): void {
  const before = JSON.stringify(host);
  for (const body of bodies) {
    const now = host.record.updatedAt + 10;
    const r = hostSubmit(ruleset, host.record, host.secret, body as unknown as Submission, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(["staleSeq", "illegalAnswer"]).toContain(r.error.code);
  }
  expect(JSON.stringify(host)).toBe(before);
  expect(host.record.status).toEqual({ kind: "active" });
}
