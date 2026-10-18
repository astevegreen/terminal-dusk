import { createGame, eventsFor, pendingFor, seedHash, viewFor } from "@terminal-dusk/engine";
import type { Seed } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { hostCreate } from "./hostCreate.ts";
import { deepFreeze } from "./test/deepFreeze.ts";
import { makeConfig, NOW, ruleset, SEED } from "./test/match.ts";
import type { HostResult, MatchConfig } from "./types.ts";

/** hostCreate with the test inputs, expected to succeed. */
function started(config: MatchConfig = makeConfig()): HostResult {
  const r = hostCreate(ruleset, config, SEED, NOW);
  if (!r.ok) throw new Error(`hostCreate failed: ${r.error.code}`);
  return r.value;
}

/** What the engine itself gives for the test inputs. */
function engineGame() {
  const config = makeConfig();
  const r = createGame(ruleset, { ...config.setup, seedHash: seedHash(SEED) }, SEED);
  if (!r.ok) throw new Error(`createGame failed: ${r.error.code}`);
  return r.value;
}

const errorCode = (config: unknown, now = NOW): string | undefined => {
  const r = hostCreate(ruleset, config as MatchConfig, SEED, now);
  return r.ok ? undefined : r.error.code;
};

describe("hostCreate: a successful start", () => {
  it("stores the seed, the setup with the seed's fingerprint, the engine's state and an empty log in the secret", () => {
    const { secret } = started();
    const engine = engineGame();
    expect(secret.seed).toBe(SEED);
    expect(secret.setup).toEqual({ ...makeConfig().setup, seedHash: seedHash(SEED) });
    expect(secret.state).toEqual(engine.state);
    expect(secret.log).toEqual([]);
  });

  it("fills the record from the config, the state and now, with exactly the listed keys", () => {
    const { record, secret } = started();
    expect(Object.keys(record).sort()).toEqual(
      ["createdAt", "matchId", "players", "ruleset", "seedHash", "seq", "status", "updatedAt"].sort(),
    );
    expect(record).toEqual({
      matchId: "match-1",
      players: { lio: "alice", sae: "bob" },
      ruleset: ruleset.id,
      seedHash: seedHash(SEED),
      seq: secret.state.meta.seq,
      status: secret.state.public.status,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("stores only the ruleset's id, never the ruleset itself", () => {
    const { record, secret } = started();
    expect(record.ruleset).toBe(ruleset.id);
    for (const part of [record, secret]) expect(JSON.stringify(part)).not.toContain('"cards":[{');
  });

  it("gives each viewer a frame of its view, its events and its decision, at the state's seq", () => {
    const { frames } = started();
    const { state, events } = engineGame();
    for (const viewer of ["lio", "sae", "spectator"] as const) {
      const frame = frames[viewer];
      expect(frame.matchId).toBe("match-1");
      expect(frame.seq).toBe(state.meta.seq);
      expect(frame.viewer).toBe(viewer);
      expect(frame.ruleset).toBe(ruleset.id);
      expect(frame.view).toEqual(viewFor(state, viewer));
      expect(frame.events).toEqual(eventsFor(events, viewer));
      expect(frame.decision).toEqual(viewer === "spectator" ? null : pendingFor(state, viewer));
    }
    expect(Object.keys(frames).sort()).toEqual(["lio", "sae", "spectator"]);
    expect(frames.lio.decision).not.toBeNull();
    expect(frames.sae.decision).not.toBeNull();
  });

  it("notifies each side's player with a decision waiting, in SIDES order", () => {
    expect(started().effects).toEqual([{ notify: "alice" }, { notify: "bob" }]);
  });
});

describe("hostCreate: refusals", () => {
  it("refuses an empty matchId with invalidConfig", () => {
    expect(errorCode({ ...makeConfig(), matchId: "" })).toBe("invalidConfig");
  });

  it("refuses a missing player id with invalidConfig", () => {
    expect(errorCode({ ...makeConfig(), players: { lio: "alice" } })).toBe("invalidConfig");
    expect(errorCode({ ...makeConfig(), players: { sae: "bob" } })).toBe("invalidConfig");
  });

  it("refuses an empty player id with invalidConfig", () => {
    expect(errorCode({ ...makeConfig(), players: { lio: "", sae: "bob" } })).toBe("invalidConfig");
    expect(errorCode({ ...makeConfig(), players: { lio: "alice", sae: "" } })).toBe("invalidConfig");
  });

  it("refuses the same player id on both sides with invalidConfig", () => {
    expect(errorCode({ ...makeConfig(), players: { lio: "alice", sae: "alice" } })).toBe("invalidConfig");
  });

  it("refuses a now that is not a whole number 0 or more with invalidTime", () => {
    for (const now of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(errorCode(makeConfig(), now)).toBe("invalidTime");
    expect(errorCode(makeConfig(), 0)).toBeUndefined();
  });

  it("returns an engine refusal with the engine's code, such as a setup with 0 turns", () => {
    const config = makeConfig();
    const r = hostCreate(ruleset, { ...config, setup: { ...config.setup, turns: 0 } }, SEED, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalidSetup");
  });

  it("returns the engine's invalidSeed for an empty seed", () => {
    const r = hostCreate(ruleset, makeConfig(), "", NOW);
    expect(r.ok ? undefined : r.error.code).toBe("invalidSeed");
  });

  it("returns the engine's invalidSeed, without throwing, for a seed that is not text", () => {
    for (const seed of [42, null, undefined, { text: SEED }]) {
      const r = hostCreate(ruleset, makeConfig(), seed as unknown as Seed, NOW);
      expect(r.ok ? undefined : r.error.code).toBe("invalidSeed");
    }
  });
});

describe("hostCreate: pure", () => {
  it("never changes its deep-frozen inputs, and equal inputs give equal results", () => {
    const rs = deepFreeze(structuredCloneJson(ruleset));
    const config = deepFreeze(makeConfig());
    const first = hostCreate(rs, config, SEED, NOW);
    const second = hostCreate(rs, config, SEED, NOW);
    expect(first.ok).toBe(true);
    expect(second).toEqual(first);
    expect(config).toEqual(makeConfig());
    expect(rs).toEqual(ruleset);
  });

  it("shares nothing with the config, so later changes to the result leave the config alone", () => {
    const config = deepFreeze(makeConfig());
    const r = hostCreate(ruleset, config, SEED, NOW);
    if (!r.ok) throw new Error(r.error.code);
    expect(r.value.secret.setup.hands.lio).not.toBe(config.setup.hands.lio);
    expect(r.value.record.players).not.toBe(config.players);
  });
});

/** A plain copy of JSON data, made here so the frozen ruleset is not the shared test one. */
const structuredCloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
