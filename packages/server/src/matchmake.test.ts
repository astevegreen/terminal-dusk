import type { Side } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { matchmake, createSeek, RANKED_LIMIT, seededFirstSide } from "./matchmake.ts";
import type { MatchmakeDeps } from "./matchmake.ts";
import { MemoryEntitlementStore } from "./entitlementStore.ts";
import { MemoryNotifyStore } from "./notifyStore.ts";
import { PLACEHOLDER_PRESET_DEADLINE } from "./rankedPresets.ts";
import type { RankedPreset } from "./rankedPresets.ts";
import { MemorySeekStore } from "./seekStore.ts";
import { MemoryStore } from "./store.ts";

const T0 = 1_700_000_000_000;
const MINUTE = 60_000;
const PLAYERS = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];

function world(seedOf: (n: number) => string = (n) => `seed-${n}`) {
  const matches = new MemoryStore();
  const seeks = new MemorySeekStore(matches);
  const notify = new MemoryNotifyStore();
  const entitlements = new MemoryEntitlementStore(
    PLAYERS.map((player) => ({ player, platform: "web", source: "test" })),
  );
  let ticket = 0;
  let match = 0;
  let seed = 0;
  const deps: MatchmakeDeps = {
    seeks,
    entitlements,
    notify,
    matchId: () => `m-${++match}`,
    seed: () => seedOf(++seed),
  };
  const search = (player: string, now = T0, preset: RankedPreset = "normal", side?: Side) =>
    createSeek(
      { seeks, entitlements, matches, ticketId: () => `t-${++ticket}` },
      { player, platform: "web", preset, side, now },
    );
  const rate = (player: string, rating: number) =>
    matches.putRating({
      player,
      rating,
      deviation: 100,
      volatility: 0.06,
      ranked_games: 1,
      lio_wins: 1,
      lio_losses: 0,
      lio_draws: 0,
      sae_wins: 0,
      sae_losses: 0,
      sae_draws: 0,
      updated_at: T0,
    });
  return { matches, seeks, notify, entitlements, deps, search, rate };
}

const statuses = (results: { status: string }[]) => results.map((r) => r.status);

describe("matchmaking", () => {
  it("pairs two compatible tickets into a ranked match", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p2");
    const results = await matchmake(w.deps, T0);
    expect(results).toEqual([{ status: "paired", matchId: "m-1" }]);
    const stored = w.matches.stored("m-1")!;
    expect(stored.record.ranked).toBe(true);
    expect(new Set(Object.values(stored.record.players))).toEqual(new Set(["p1", "p2"]));
    expect(await w.seeks.open()).toEqual([]);
  });

  it("makes the match with loss on time and the preset's deadline", async () => {
    const w = world();
    await w.search("p1", T0, "slow");
    await w.search("p2", T0, "slow");
    await matchmake(w.deps, T0);
    const clock = w.matches.stored("m-1")!.record.clock!;
    expect(clock.rule).toBe("lossOnTime");
    expect(clock.days).toBe(PLACEHOLDER_PRESET_DEADLINE.slow.days);
  });

  it("does not pair tickets with different presets", async () => {
    const w = world();
    await w.search("p1", T0, "fast");
    await w.search("p2", T0, "slow");
    expect(await matchmake(w.deps, T0 + 30 * MINUTE)).toEqual([]);
    expect(await w.seeks.open()).toHaveLength(2);
  });

  it("does not pair two far-apart ratings at minute 0, but does after the band has widened", async () => {
    const w = world();
    w.rate("p1", 1500);
    w.rate("p2", 1900);
    await w.search("p1");
    await w.search("p2");
    expect(await matchmake(w.deps, T0)).toEqual([]);
    expect(await matchmake(w.deps, T0 + 5 * MINUTE)).toEqual([]);
    expect(statuses(await matchmake(w.deps, T0 + 6 * MINUTE))).toEqual(["paired"]);
  });

  it("takes anyone after 20 minutes", async () => {
    const w = world();
    w.rate("p1", 800);
    w.rate("p2", 2600);
    await w.search("p1");
    await w.search("p2");
    expect(statuses(await matchmake(w.deps, T0 + 20 * MINUTE))).toEqual(["paired"]);
  });

  it("keeps a ticket waiting across a restart", async () => {
    const w = world();
    await w.search("p1");
    expect(await matchmake(w.deps, T0)).toEqual([]);
    // A restart: new sweep deps over the same stored tickets.
    await w.search("p2", T0 + MINUTE);
    const restarted: MatchmakeDeps = { ...w.deps };
    expect(statuses(await matchmake(restarted, T0 + MINUTE))).toEqual(["paired"]);
  });

  it("run twice at the same time, pairs once", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p2");
    const [a, b] = await Promise.all([matchmake(w.deps, T0), matchmake(w.deps, T0)]);
    expect(statuses([...a, ...b]).filter((s) => s === "paired")).toHaveLength(1);
    expect(statuses(await matchmake(w.deps, T0))).toEqual([]);
  });

  it("does not pair a ticket whose player lost the Full Game since searching (#687)", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p2");
    await w.entitlements.revokeAll("p1");
    expect(await matchmake(w.deps, T0)).toEqual([]);
    expect(await w.seeks.open()).toHaveLength(2);
    expect(w.matches.stored("m-1")).toBeNull();
  });

  it("pairs the tickets that are still entitled and leaves the one that is not (#687)", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p2");
    await w.search("p3");
    await w.entitlements.revokeAll("p1");
    const results = await matchmake(w.deps, T0);
    expect(statuses(results)).toEqual(["paired"]);
    expect((await w.seeks.open()).map((t) => t.player)).toEqual(["p1"]);
  });

  it("leaves tickets alone when the entitlements cannot be read (#687)", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p2");
    const broken = { forPlayer: () => Promise.reject(new Error("down")) };
    expect(await matchmake({ ...w.deps, entitlements: broken }, T0)).toEqual([]);
    expect(await w.seeks.open()).toHaveLength(2);
  });

  it("never pairs a player with their own ticket", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p1");
    expect(await matchmake(w.deps, T0 + 30 * MINUTE)).toEqual([]);
  });

  it("gives the same split for the same seed when both want LIO, and both splits occur across seeds", async () => {
    const lioOf = async (seed: string, side?: Side) => {
      const w = world(() => seed);
      await w.search("p1", T0, "normal", side);
      await w.search("p2", T0, "normal", side);
      await matchmake(w.deps, T0);
      return w.matches.stored("m-1")!.record.players.lio;
    };
    const seen = new Set<string>();
    for (let n = 1; n <= 12; n++) {
      const seed = `seed-${n}`;
      const first = await lioOf(seed, "lio");
      expect(await lioOf(seed, "lio")).toBe(first);
      expect(await lioOf(seed)).toBe(first);
      expect(first).toBe(seededFirstSide(seed) === "lio" ? "p1" : "p2");
      seen.add(first);
    }
    expect(seen).toEqual(new Set(["p1", "p2"]));
  });

  it("gives each player the side they asked for when the preferences differ", async () => {
    const w = world();
    await w.search("p1", T0, "normal", "sae");
    await w.search("p2", T0, "normal", "lio");
    await matchmake(w.deps, T0);
    expect(w.matches.stored("m-1")!.record.players).toEqual({ lio: "p2", sae: "p1" });
  });

  it("gives a lone preference its side", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p2", T0, "normal", "sae");
    await matchmake(w.deps, T0);
    expect(w.matches.stored("m-1")!.record.players.sae).toBe("p2");
  });

  it("queues a turn alert for both players, since both have a decision at the start", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p2");
    await matchmake(w.deps, T0);
    const queued = ["p1", "p2"].filter((p) => w.notify.stored("m-1", p) !== null);
    expect(queued).toEqual(["p1", "p2"]);
  });

  it("refuses a 6th ranked game, counting running matches and open tickets", async () => {
    const w = world();
    for (let n = 0; n < RANKED_LIMIT; n++) expect((await w.search("p1")).ok).toBe(true);
    const sixth = await w.search("p1");
    expect(sixth).toMatchObject({ ok: false, error: { code: "limitReached" } });
    expect((await w.seeks.open()).filter((t) => t.player === "p1")).toHaveLength(RANKED_LIMIT);
  });

  it("counts a running ranked match toward the limit", async () => {
    const w = world();
    await w.search("p1");
    await w.search("p2");
    await matchmake(w.deps, T0);
    for (let n = 0; n < RANKED_LIMIT - 1; n++) expect((await w.search("p1")).ok).toBe(true);
    expect((await w.search("p1")).ok).toBe(false);
  });

  it("refuses a player who does not own the full game on the platform", async () => {
    const w = world();
    const refused = await w.search("stranger");
    expect(refused).toMatchObject({ ok: false, error: { code: "notEntitled" } });
    expect(await w.seeks.open()).toEqual([]);
  });

  it("refuses an unknown preset", async () => {
    const w = world();
    const refused = await w.search("p1", T0, "turbo" as RankedPreset);
    expect(refused).toMatchObject({ ok: false, error: { code: "invalidSeek" } });
  });
});
