import { hostSubmit } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import type { LoadedMatch, MatchStore } from "./store.ts";
import { submit } from "./submit.ts";
import type { SubmitDeps } from "./submit.ts";
import { bodyFor, MATCH, NOW, ruleset, setup } from "./test/match.ts";
import { loadTogether } from "./test/stores.ts";

describe("submit: two answers for the same seq at once", () => {
  it("exactly one succeeds, the other gets staleSeq, and the stored match is the winner's", async () => {
    const { store, deps, start } = setup();
    const racing: SubmitDeps = { ...deps, store: loadTogether(store, 2) };
    const bodies = [bodyFor(0, start.secret, "lio", 0), bodyFor(0, start.secret, "lio", 1)];
    expect(bodies[0]).not.toEqual(bodies[1]);

    const results = await Promise.all(
      bodies.map((body, i) => submit(racing, { matchId: MATCH, player: "alice", body, now: NOW + i })),
    );

    const winners = results.flatMap((r, i) => (r.ok ? [i] : []));
    expect(winners).toHaveLength(1);
    const winner = winners[0]!;
    expect(results[1 - winner]).toMatchObject({ ok: false, error: { code: "staleSeq" } });
    const expected = hostSubmit(
      ruleset,
      start.record,
      start.secret,
      { player: "alice", ...bodies[winner] } as never,
      NOW + winner,
    );
    if (!expected.ok) throw new Error("the host refused the winner's answer");
    expect(store.stored(MATCH)).toEqual({
      record: expected.value.record,
      secret: expected.value.secret,
      frames: expected.value.frames,
    });
  });
});

describe("submit: a storage failure gives storageFailed and never throws", () => {
  const failing = (part: "load" | "commit", how: "throws" | "rejects", inner: MatchStore): MatchStore => {
    const fail = () => {
      if (how === "throws") throw new Error("disk on fire: seed server-seed-1");
      return Promise.reject(new Error("disk on fire: seed server-seed-1"));
    };
    return {
      load: part === "load" ? (fail as () => Promise<LoadedMatch | null>) : (id) => inner.load(id),
      commit: part === "commit" ? (fail as MatchStore["commit"]) : (id, seq, write) => inner.commit(id, seq, write),
    };
  };

  for (const part of ["load", "commit"] as const) {
    for (const how of ["throws", "rejects"] as const) {
      it(`a ${part} that ${how} gives storageFailed, with none of the thrown text`, async () => {
        const { store, deps, start } = setup();
        const broken: SubmitDeps = { ...deps, store: failing(part, how, store) };
        const body = bodyFor(0, start.secret, "lio");
        const result = await submit(broken, { matchId: MATCH, player: "alice", body, now: NOW });
        expect(result).toMatchObject({ ok: false, error: { code: "storageFailed" } });
        expect(JSON.stringify(result)).not.toContain("disk on fire");
        expect(store.stored(MATCH)).toEqual({ record: start.record, secret: start.secret, frames: start.frames });
      });
    }
  }

  it("a ruleset lookup that throws gives unknownRuleset and does not throw", async () => {
    const { deps, start } = setup();
    const lookup = () => {
      throw new Error("no rulesets");
    };
    const body = bodyFor(0, start.secret, "lio");
    const result = await submit({ ...deps, ruleset: lookup }, { matchId: MATCH, player: "alice", body, now: NOW });
    expect(result).toMatchObject({ ok: false, error: { code: "unknownRuleset" } });
  });
});
