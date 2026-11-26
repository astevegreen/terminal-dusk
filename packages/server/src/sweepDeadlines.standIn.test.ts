// The deadline sweep under the "defaultAnswer" rule (#605, #616): what it reports when the stand-in's own
// answers end the game.
import { pendingFor } from "@terminal-dusk/engine";
import type { RulesetId } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "./store.ts";
import { submit } from "./submit.ts";
import { sweepDeadlines } from "./sweepDeadlines.ts";
import type { SweepResult } from "./sweepDeadlines.ts";
import { DAY, insertSaeLate, rulesetFor } from "./test/deadlines.ts";
import { bodyFor, NOW } from "./test/match.ts";

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

describe("sweepDeadlines: a stand-in with no legal answer (#616)", () => {
  it("parks the match: skipped with standInNoAnswer, seq and game unchanged, the late side's deadline cleared", async () => {
    const store = new MemoryStore();
    await insertSaeLate(store, "m1", "defaultAnswer", NOW);
    const before = store.stored("m1")!;
    const state = before.secret.state;
    // Only possible through a bug: SAE's opening pick with an empty hand has no legal answer.
    const empty = { ...state, private: { ...state.private, sae: { ...state.private.sae, hand: [] } } };
    store.insert("m1", { ...before, secret: { ...before.secret, state: empty } });
    const due = before.record.clock!.deadlines.sae!;
    expect(await sweepDeadlines(store, rulesetFor, due)).toEqual([
      { matchId: "m1", status: "skipped", code: "standInNoAnswer" },
    ]);
    const parked = store.stored("m1")!;
    expect(parked.record.seq).toBe(before.record.seq);
    expect(parked.record.status).toEqual(before.record.status);
    expect(parked.secret.log).toEqual(before.secret.log);
    expect(parked.secret.state).toEqual(empty);
    expect(parked.record.clock!.deadlines.sae).toBeNull();
    expect(await sweepDeadlines(store, rulesetFor, due)).toEqual([]);
    expect(await sweepDeadlines(store, rulesetFor, due + DAY)).toEqual([]);
    expect(store.stored("m1")).toEqual(parked);
  });
});
