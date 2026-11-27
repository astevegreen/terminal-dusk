// The stand-in's two edges under "defaultAnswer" (#616, Decision (architect) there): reaching its answer limit
// saves what it made and carries on next sweep; finding no legal answer ends the game in a draw on time (owner,
// 26 Nov 2026, in chat: "Draw on time"; #629).
import { pendingFor } from "@terminal-dusk/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hostDeadline } from "./hostDeadline.ts";
import { standIn } from "./hostStandIn.ts";
import { clockOf, DAY, lioToPlay, startedWith, swept } from "./test/clock.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { NOW, ruleset } from "./test/match.ts";
import { accept, submissionFor } from "./test/play.ts";
import type { HostResult } from "./types.ts";

/** LIO's deadline in lioToPlay: it got its play decision at NOW + 2. */
const LIO_DUE = NOW + 2 + DAY;
/** LIO's deadline for the opening pick, which it got at NOW. */
const PICK_DUE = NOW + DAY;
/** While true, the default answer finds nothing: the bug the no-answer tests stand for. */
const bug = vi.hoisted(() => ({ noAnswer: false, illegal: false }));
vi.mock("./defaultAnswer.ts", async (actual) => {
  const real = await actual<typeof import("./defaultAnswer.ts")>();
  return {
    ...real,
    defaultAnswer: (...args: Parameters<typeof real.defaultAnswer>) =>
      bug.noAnswer ? null : bug.illegal ? { kind: "realign", country: "nowhere" } : real.defaultAnswer(...args),
  };
});
afterEach(() => {
  bug.noAnswer = false;
  bug.illegal = false;
});
const answersAdded = (from: HostResult, to: HostResult): number => to.secret.log.length - from.secret.log.length;

describe("the stand-in at its answer limit", () => {
  it("saves the answers made so far; the side stays covered and due at once, and the next sweep carries on", () => {
    // SAE makes its opening pick; LIO, absent, owes its pick and then its play in the same turn.
    const start = startedWith("defaultAnswer");
    const host = deepFreeze(accept(start, submissionFor(start, "sae"), NOW + 1));
    const whole = swept(host, PICK_DUE);
    expect(answersAdded(host, whole)).toBeGreaterThanOrEqual(2); // the turn needs more than one answer
    const r = standIn(ruleset, host.record, host.secret, clockOf(host), "lio", PICK_DUE, 1);
    if (!r.ok) throw new Error(`expected ok, got ${r.error.code}`);
    const part = r.value;
    expect(answersAdded(host, part)).toBe(1);
    expect(part.record.seq).toBe(host.record.seq + 1);
    expect(pendingFor(part.secret.state, "lio")).not.toBeNull();
    expect(clockOf(part).covering).toEqual({ lio: host.secret.state.public.turn, sae: null });
    expect(clockOf(part).deadlines.lio).toBe(PICK_DUE);
    expect(part.effects.filter((e) => "notify" in e)).toEqual([]);
    expect(part.frames.spectator.standIn).toBe("lio");
    const rest = swept(part, PICK_DUE);
    expect(rest.secret.log).toEqual(whole.secret.log);
    expect(rest.record.seq).toBe(whole.record.seq);
  });
});

describe("the stand-in with no legal answer (only possible through a bug)", () => {
  /** lioToPlay, with the default answer finding nothing for LIO's play decision from now on. */
  function noAnswer(): HostResult {
    const host = deepFreeze(lioToPlay("defaultAnswer"));
    bug.noAnswer = true;
    return host;
  }

  it("ends the game in a draw on time, recorded in the log as the host's word that it could not move", () => {
    const host = noAnswer();
    const before = JSON.stringify(host);
    const drawn = swept(host, LIO_DUE);
    expect(JSON.stringify(host)).toBe(before);
    expect(drawn.record.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(drawn.secret.state.public.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(drawn.record.seq).toBe(host.record.seq + 1);
    expect(drawn.secret.log).toEqual([...host.secret.log, { system: "timeout", side: "both", stuck: "lio" }]);
    expect(drawn.record.updatedAt).toBe(LIO_DUE);
  });

  it("a default answer the engine refuses is a draw on time too", () => {
    const host = deepFreeze(lioToPlay("defaultAnswer"));
    bug.illegal = true;
    const drawn = swept(host, LIO_DUE);
    expect(drawn.record.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(drawn.secret.log).toEqual([...host.secret.log, { system: "timeout", side: "both", stuck: "lio" }]);
  });

  it("a drawn match is over, so later sweeps leave it alone", () => {
    const drawn = swept(noAnswer(), LIO_DUE);
    const again = hostDeadline(ruleset, drawn.record, drawn.secret, LIO_DUE + DAY);
    expect(again.ok ? "ok" : again.error.code).toBe("gameOver");
  });
});
