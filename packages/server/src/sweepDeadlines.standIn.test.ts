// The deadline sweep under the "defaultAnswer" rule (#605, #616): what it reports when the stand-in's own
// answers end the game.
import { pendingFor } from "@terminal-dusk/engine";
import type { RulesetId } from "@terminal-dusk/engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryStore } from "./store.ts";
import { submit } from "./submit.ts";
import { sweepDeadlines } from "./sweepDeadlines.ts";
import type { SweepResult } from "./sweepDeadlines.ts";
import { DAY, insertSaeLate, rulesetFor } from "./test/deadlines.ts";
import { bodyFor, NOW } from "./test/match.ts";

/** While true, the engine lists no legal answers, so the host finds no default answer: the bug the test stands for. */
const bug = vi.hoisted(() => ({ noAnswer: false }));
vi.mock("@terminal-dusk/engine", async (actual) => {
  const real = await actual<typeof import("@terminal-dusk/engine")>();
  return {
    ...real,
    legalAnswers: (...args: Parameters<typeof real.legalAnswers>) => (bug.noAnswer ? [] : real.legalAnswers(...args)),
  };
});
afterEach(() => {
  bug.noAnswer = false;
});

const deps = (store: MemoryStore) => ({
  store,
  ruleset: (id: RulesetId) => rulesetFor(id) ?? undefined,
  notify: undefined,
});

describe("sweepDeadlines: a stand-in step that ends the game (#616)", () => {
  it("reports timedOut, not answered, when the stand-in's own answers end the game", async () => {
    // SAE never answers; LIO plays every decision it gets. The game ends on one of SAE's stand-in steps.
    const store = new MemoryStore();
    await insertSaeLate(store, "m1", "defaultAnswer", NOW);
    let now = NOW + 1;
    let last: SweepResult[] | null = null;
    for (let step = 0; store.stored("m1")!.record.status.kind === "active"; step++) {
      expect(step).toBeLessThan(2_000);
      const { record, secret } = store.stored("m1")!;
      const saeDue = record.clock!.deadlines.sae;
      if (pendingFor(secret.state, "lio") !== null && (saeDue === null || saeDue > now)) {
        now += 1;
        const body = bodyFor(record.seq, secret, "lio");
        const sent = await submit(deps(store), { matchId: "m1", player: "alice", body, now });
        expect(sent.ok).toBe(true);
        last = null;
      } else {
        now = Math.max(now, saeDue ?? now);
        last = await sweepDeadlines(store, rulesetFor, now);
        expect(last).toHaveLength(1);
      }
    }
    expect(last, "the game should end on a stand-in step").not.toBeNull();
    expect(store.stored("m1")!.frames.spectator.standIn).toBe("sae");
    expect(last).toEqual([{ matchId: "m1", status: "timedOut" }]);
  });
});

describe("sweepDeadlines: a stand-in with no legal answer (#616, #629)", () => {
  it("ends the game in a draw on time and reports timedOut; later sweeps leave it alone", async () => {
    // Owner, 26 Nov 2026, in chat: "Draw on time".
    const store = new MemoryStore();
    await insertSaeLate(store, "m1", "defaultAnswer", NOW);
    const before = store.stored("m1")!;
    bug.noAnswer = true; // only possible through a bug: no default answer for SAE's opening pick
    const due = before.record.clock!.deadlines.sae!;
    expect(await sweepDeadlines(store, rulesetFor, due)).toEqual([{ matchId: "m1", status: "timedOut" }]);
    const drawn = store.stored("m1")!;
    expect(drawn.record.status).toEqual({ kind: "over", winner: null, reason: "timeout" });
    expect(drawn.record.seq).toBe(before.record.seq + 1);
    expect(drawn.secret.log).toEqual([...before.secret.log, { system: "timeout", side: "both", stuck: "sae" }]);
    expect(await sweepDeadlines(store, rulesetFor, due)).toEqual([]);
    expect(await sweepDeadlines(store, rulesetFor, due + DAY)).toEqual([]);
    expect(store.stored("m1")).toEqual(drawn);
  });
});
