// Finalize's rating step (#679), with the in-memory store: the finish of a ranked game updates both players'
// ratings once, in the same commit as the finish; anything else updates nothing.
import { hostSubmit, START_RATING } from "@terminal-dusk/host";
import type { HostResult, MatchRecord } from "@terminal-dusk/host";
import { describe, expect, it } from "vitest";
import { commitStep, RATING_TRIES, RatingError } from "./finalize.ts";
import type { RatingRow } from "./ratings.ts";
import { MemoryStore } from "./store.ts";
import type { MatchStore } from "./store.ts";
import { submit } from "./submit.ts";
import { sweepDeadlines } from "./sweepDeadlines.ts";
import { DAY } from "./test/deadlines.ts";
import { NOW } from "./test/match.ts";
import { officialBody, officialRuleset, PLAYERS, rankedMatch, rankedWorld, rulesetFor } from "./test/ranked.ts";
import { writeOf } from "./test/stack.ts";

const resign = (deps: Parameters<typeof submit>[0], matchId: string, player: string, now = NOW + 1) =>
  submit(deps, { matchId, player, body: { resign: true }, now });

const byPlayer = (rows: RatingRow[]) => Object.fromEntries(rows.map((row) => [row.player, row]));
const ratingsOf = async (store: MemoryStore) => byPlayer(await store.ratings([PLAYERS.lio, PLAYERS.sae]));

/** Every result count of a row, by column. */
const results = (row: RatingRow | undefined) =>
  row && {
    games: row.ranked_games,
    lio: [row.lio_wins, row.lio_losses, row.lio_draws],
    sae: [row.sae_wins, row.sae_losses, row.sae_draws],
  };

/** A row that has played `games` ranked games, all won as LIO, at `rating`. */
const playedRow = (player: string, games: number, rating: number): RatingRow => ({
  player,
  rating,
  deviation: 120,
  volatility: 0.06,
  ranked_games: games,
  lio_wins: games,
  lio_losses: 0,
  lio_draws: 0,
  sae_wins: 0,
  sae_losses: 0,
  sae_draws: 0,
  updated_at: NOW - DAY,
});

describe("Finalize: a ranked game's finish updates both ratings once, with the finish", () => {
  it("a resignation gives the other player a win, and both players get their first row", async () => {
    const { store, deps } = rankedWorld(rankedMatch());
    expect((await resign(deps, "ranked-1", PLAYERS.lio)).ok).toBe(true);
    const rows = await ratingsOf(store);
    expect(results(rows[PLAYERS.lio])).toEqual({ games: 1, lio: [0, 1, 0], sae: [0, 0, 0] });
    expect(results(rows[PLAYERS.sae])).toEqual({ games: 1, lio: [0, 0, 0], sae: [1, 0, 0] });
    expect(rows[PLAYERS.sae]!.rating).toBeGreaterThan(START_RATING.rating);
    expect(rows[PLAYERS.lio]!.rating).toBeLessThan(START_RATING.rating);
    expect(rows[PLAYERS.lio]!.updated_at).toBe(NOW + 1);
    expect((await store.load("ranked-1"))!.record.status).toMatchObject({ kind: "over", winner: "sae" });
  });

  it("a later finish adds to the rows a player already has, rated against the other's rating", async () => {
    const { store, deps } = rankedWorld(rankedMatch());
    store.putRating(playedRow(PLAYERS.lio, 4, 1700));
    expect((await resign(deps, "ranked-1", PLAYERS.sae)).ok).toBe(true);
    const rows = await ratingsOf(store);
    expect(results(rows[PLAYERS.lio])).toEqual({ games: 5, lio: [5, 0, 0], sae: [0, 0, 0] });
    expect(results(rows[PLAYERS.sae])).toEqual({ games: 1, lio: [0, 0, 0], sae: [0, 1, 0] });
    expect(rows[PLAYERS.lio]!.rating).toBeGreaterThan(1700);
    // Losing to a 1700 player costs less than losing to a 1500 one.
    const even = rankedWorld(rankedMatch());
    await resign(even.deps, "ranked-1", PLAYERS.sae);
    expect(rows[PLAYERS.sae]!.rating).toBeGreaterThan((await ratingsOf(even.store))[PLAYERS.sae]!.rating);
  });

  it("running the finish twice changes nothing the second time", async () => {
    const match = rankedMatch();
    const { store, deps } = rankedWorld(match);
    const over = hostSubmit(
      officialRuleset,
      match.record,
      match.secret,
      { player: PLAYERS.lio, resign: true },
      NOW + 1,
    );
    if (!over.ok) throw new Error(over.error.code);
    expect(await commitStep(store, match.record, writeOf(over.value), NOW + 1)).toBe("saved");
    const once = await ratingsOf(store);
    expect(await commitStep(store, match.record, writeOf(over.value), NOW + 2)).toBe("conflict");
    expect((await resign(deps, "ranked-1", PLAYERS.lio, NOW + 3)).ok).toBe(false);
    expect(await ratingsOf(store)).toEqual(once);
  });

  it("a loss on time gives the other player a win, and a second sweep changes nothing", async () => {
    const { store, deps } = rankedWorld(rankedMatch({ deadline: "lossOnTime" }));
    const loaded = (await store.load("ranked-1"))!;
    const picked = await submit(deps, {
      matchId: "ranked-1",
      player: PLAYERS.lio,
      body: officialBody(0, loaded.secret, "lio"),
      now: NOW + 1,
    });
    expect(picked.ok).toBe(true);
    expect(await store.ratings([PLAYERS.lio, PLAYERS.sae])).toEqual([]);
    expect(await sweepDeadlines(store, rulesetFor, NOW + DAY)).toEqual([{ matchId: "ranked-1", status: "timedOut" }]);
    expect((await store.load("ranked-1"))!.record.status).toMatchObject({ kind: "over", winner: "lio" });
    const rows = await ratingsOf(store);
    expect(results(rows[PLAYERS.lio])).toEqual({ games: 1, lio: [1, 0, 0], sae: [0, 0, 0] });
    expect(results(rows[PLAYERS.sae])).toEqual({ games: 1, lio: [0, 0, 0], sae: [0, 1, 0] });
    await sweepDeadlines(store, rulesetFor, NOW + DAY + 60_000);
    expect(await ratingsOf(store)).toEqual(rows);
  });

  it("a draw on time gives each player a draw", async () => {
    const { store } = rankedWorld(rankedMatch({ deadline: "lossOnTime" }));
    expect(await sweepDeadlines(store, rulesetFor, NOW + DAY)).toEqual([{ matchId: "ranked-1", status: "timedOut" }]);
    expect((await store.load("ranked-1"))!.record.status).toMatchObject({ kind: "over", winner: null });
    const rows = await ratingsOf(store);
    expect(results(rows[PLAYERS.lio])).toEqual({ games: 1, lio: [0, 0, 1], sae: [0, 0, 0] });
    expect(results(rows[PLAYERS.sae])).toEqual({ games: 1, lio: [0, 0, 0], sae: [0, 0, 1] });
    expect(rows[PLAYERS.lio]!.rating).toBeCloseTo(START_RATING.rating, 6);
  });
});

describe("Finalize: each rated finish records both players' rating change (#734)", () => {
  it("a rated finish writes 2 rows with the right before and after, a first game starting at the start rating", async () => {
    const { store, deps } = rankedWorld(rankedMatch());
    store.putRating(playedRow(PLAYERS.lio, 4, 1700));
    expect((await resign(deps, "ranked-1", PLAYERS.sae)).ok).toBe(true);
    const rows = await ratingsOf(store);
    const changes = store.ratingChanges("ranked-1");
    expect(changes).toHaveLength(2);
    const by = Object.fromEntries(changes.map((c) => [c.player, c]));
    expect(by[PLAYERS.lio]).toEqual({
      match_id: "ranked-1",
      player: PLAYERS.lio,
      rating_before: 1700,
      rating_after: rows[PLAYERS.lio]!.rating,
      ranked_games: 5,
      created_at: NOW + 1,
    });
    expect(by[PLAYERS.sae]).toMatchObject({
      rating_before: START_RATING.rating,
      rating_after: rows[PLAYERS.sae]!.rating,
      ranked_games: 1,
    });
  });

  it("an unranked finish writes none", async () => {
    const { store, deps } = rankedWorld(rankedMatch({ ranked: false }));
    await resign(deps, "ranked-1", PLAYERS.lio);
    expect(store.ratingChanges("ranked-1")).toEqual([]);
  });

  it("a ratingsMoved retry leaves none behind from the refused tries, and one pair at the end", async () => {
    const match = rankedMatch();
    const { store, deps } = rankedWorld(match);
    const failing = rankedWorld(match);
    await resign({ ...deps, store: racing(failing.store, RATING_TRIES) }, "ranked-1", PLAYERS.lio);
    expect(failing.store.ratingChanges("ranked-1")).toEqual([]);
    await resign(deps, "ranked-1", PLAYERS.lio);
    expect(store.ratingChanges("ranked-1")).toHaveLength(2);
  });
});

describe("Finalize: anything but a ranked game's finish updates nothing", () => {
  it.each([
    ["a game that is not ranked", { ranked: false }],
    ["a ranked game on a modded ruleset", { official: false }],
  ])("%s", async (_name, options) => {
    const { store, deps } = rankedWorld(rankedMatch(options));
    expect((await resign(deps, "ranked-1", PLAYERS.lio)).ok).toBe(true);
    expect((await store.load("ranked-1"))!.record.status.kind).toBe("over");
    expect(await store.ratings([PLAYERS.lio, PLAYERS.sae])).toEqual([]);
  });

  it("a step of a ranked game that is still going", async () => {
    const { store, deps } = rankedWorld(rankedMatch());
    const loaded = (await store.load("ranked-1"))!;
    const body = officialBody(0, loaded.secret, "lio");
    expect((await submit(deps, { matchId: "ranked-1", player: PLAYERS.lio, body, now: NOW + 1 })).ok).toBe(true);
    expect(await store.ratings([PLAYERS.lio, PLAYERS.sae])).toEqual([]);
  });
});

/** A store where, before each of the first `times` rating reads, another finish rates alice first. */
function racing(inner: MemoryStore, times: number): MatchStore {
  let raced = 0;
  return {
    load: (id) => inner.load(id),
    commit: (id, seq, write) => inner.commit(id, seq, write),
    async ratings(players) {
      const read = await inner.ratings(players);
      if (raced++ < times) {
        const alice = read.find((row) => row.player === PLAYERS.lio);
        inner.putRating(playedRow(PLAYERS.lio, (alice?.ranked_games ?? 0) + 1, 1600));
      }
      return read;
    },
  };
}

describe("Finalize: when another finish rates a player first, the finish reads the ratings again", () => {
  const finish = (): { match: HostResult; after: MatchRecord; write: ReturnType<typeof writeOf> } => {
    const match = rankedMatch();
    const over = hostSubmit(
      officialRuleset,
      match.record,
      match.secret,
      { player: PLAYERS.lio, resign: true },
      NOW + 1,
    );
    if (!over.ok) throw new Error(over.error.code);
    return { match, after: over.value.record, write: writeOf(over.value) };
  };

  it("it retries with the new rows and saves the finish with them", async () => {
    const { match, write } = finish();
    const { store } = rankedWorld(match);
    expect(await commitStep(racing(store, RATING_TRIES - 1), match.record, write, NOW + 1)).toBe("saved");
    const rows = await ratingsOf(store);
    // The racing finishes left alice at 2 games; this one made it 3.
    expect(results(rows[PLAYERS.lio])).toEqual({ games: 3, lio: [2, 1, 0], sae: [0, 0, 0] });
    expect((await store.load("ranked-1"))!.record.status.kind).toBe("over");
  });

  it("if they keep moving it saves nothing, and submit answers storageFailed", async () => {
    const { match, write } = finish();
    const { store, deps } = rankedWorld(match);
    await expect(commitStep(racing(store, RATING_TRIES), match.record, write, NOW + 1)).rejects.toThrow(RatingError);
    expect((await store.load("ranked-1"))!.record.status.kind).toBe("active");
    const again = rankedWorld(match);
    const outcome = await resign({ ...deps, store: racing(again.store, RATING_TRIES) }, "ranked-1", PLAYERS.lio);
    expect(outcome).toMatchObject({ ok: false, error: { code: "storageFailed" } });
    expect((await again.store.load("ranked-1"))!.record.status.kind).toBe("active");
  });
});
