// The stand-in's two edges under "defaultAnswer" (#616, Decision (architect) there): reaching its answer limit
// saves what it made and carries on next sweep; finding no legal answer parks the match instead of refusing.
import { legalAnswers, pendingFor } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
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
  /** lioToPlay with LIO's hand emptied, so its play decision has no legal answer. */
  function noAnswer(): HostResult {
    const host = lioToPlay("defaultAnswer");
    const state = host.secret.state;
    const empty = { ...state, private: { ...state.private, lio: { ...state.private.lio, hand: [] } } };
    const stuck = deepFreeze({ ...host, secret: { ...host.secret, state: empty } });
    if (pendingFor(empty, "lio") === null || legalAnswers(ruleset, empty, "lio").length > 0) {
      throw new Error("expected a decision with no legal answer");
    }
    return stuck;
  }

  it("parks the match: seq, state and log stay the same, and the late side's deadline is cleared", () => {
    const host = noAnswer();
    const before = JSON.stringify(host);
    const parked = swept(host, LIO_DUE);
    expect(JSON.stringify(host)).toBe(before);
    expect(parked.record.seq).toBe(host.record.seq);
    expect(parked.record.status).toEqual(host.record.status);
    expect(parked.secret).toEqual(host.secret);
    expect(clockOf(parked).deadlines.lio).toBeNull();
    expect(clockOf(parked).covering).toEqual(clockOf(host).covering);
    expect(parked.record.updatedAt).toBe(LIO_DUE);
    expect(parked.frames.spectator.standIn).toBeUndefined();
    expect(parked.effects.filter((e) => "notify" in e)).toEqual([]);
  });

  it("a parked match is not due again, so later sweeps leave it alone", () => {
    const parked = swept(noAnswer(), LIO_DUE);
    const again = hostDeadline(ruleset, parked.record, parked.secret, LIO_DUE + DAY);
    expect(again.ok ? "ok" : again.error.code).toBe("notDue");
  });
});
