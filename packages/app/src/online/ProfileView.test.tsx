// The profile view and the rating words, at the 844x390 phone size's content (no browser: the view has no hooks,
// so it is rendered to a string and its tap targets read from the elements).
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LOBBY_ANON_KEY, LOBBY_URL, PLAYER, TOKEN, createFakeLobby } from "./test/fakeLobby.ts";
import { matchRanked, matchRatingChange, playerRating } from "./playerRating.ts";
import type { PlayerRating } from "./playerRating.ts";
import { ProfileView } from "./ProfileView.tsx";
import { ratingChange, ratingChangeText } from "./ratingText.ts";
import type { RatingChange } from "./ratingText.ts";

const row = (over: Partial<PlayerRating> = {}): PlayerRating => ({
  rating: 1512.4,
  rankedGames: 12,
  lio: { wins: 4, losses: 2, draws: 1 },
  sae: { wins: 3, losses: 1, draws: 1 },
  updatedAt: 5,
  ...over,
});
const page = (rating: PlayerRating | null | "loading" | "failed"): string =>
  renderToString(<ProfileView name="Pat" rating={rating} onBack={() => {}} />).replaceAll("<!-- -->", "");

describe("profile view", () => {
  it("shows a whole-number rating and the record as LIO and as SAE", () => {
    const out = page(row());
    expect(out).toContain("Rating: 1512");
    expect(out).toContain("As LIO: 4 won, 2 lost, 1 drawn");
    expect(out).toContain("As SAE: 3 won, 1 lost, 1 drawn");
    expect(out).not.toContain("Provisional");
    expect(out).toContain("Placeholder:");
  });
  it("says Unrated before a first ranked game, with empty records", () => {
    const out = page(null);
    expect(out).toContain("Rating: Unrated");
    expect(out).toContain("As LIO: 0 won, 0 lost, 0 drawn");
    expect(out).toContain("As SAE: 0 won, 0 lost, 0 drawn");
    expect(out).not.toContain("Provisional");
  });
  it("says Provisional while ranked games are under 10, and not at 10", () => {
    expect(page(row({ rankedGames: 9 }))).toContain(">Provisional<");
    expect(page(row({ rankedGames: 10 }))).not.toContain("Provisional");
  });
  it("shows a loading line and a failure line without a rating", () => {
    expect(page("loading")).toContain("Loading");
    expect(page("failed")).toContain("could not be read");
    expect(page("failed")).not.toContain("Rating:");
  });
  it("keeps the Back tap target at 44 px and wraps long names so nothing scrolls sideways", () => {
    const out = page(row());
    expect(out).toContain("min-height:44px");
    expect(out).toContain("min-width:44px");
    expect(out).toContain("max-width:100%");
  });
});

describe("rating change on the result screen", () => {
  it("reads 1512, up 12 for a ranked game from its rating_change row", () => {
    const c = ratingChange(true, { before: 1500, after: 1512, rankedGames: 4 });
    expect(c).toEqual({ kind: "changed", after: 1512, change: 12 });
    expect(ratingChangeText(c as Extract<RatingChange, { kind: "changed" }>)).toBe("1512, up 12");
  });
  it("reads down and unchanged", () => {
    expect(ratingChangeText({ kind: "changed", after: 1488, change: -12 })).toBe("1488, down 12");
    expect(ratingChangeText({ kind: "changed", after: 1500, change: 0 })).toBe("1500, unchanged");
  });
  it("rounds both ends before taking the difference", () => {
    expect(ratingChange(true, { before: 1500.4, after: 1511.6, rankedGames: 1 })).toEqual({
      kind: "changed",
      after: 1512,
      change: 12,
    });
  });
  it("shows nothing for an unranked game", () => {
    expect(ratingChange(false, { before: 1500, after: 1512, rankedGames: 1 })).toEqual({ kind: "none" });
  });
  it("says it has not updated, and guesses no number, while the row is missing", () => {
    expect(ratingChange(true, null)).toEqual({ kind: "waiting" });
  });
});

const ROW_BODY = {
  rating: 1500.5,
  ranked_games: 2,
  lio_wins: 1,
  lio_losses: 0,
  lio_draws: 0,
  sae_wins: 0,
  sae_losses: 1,
  sae_draws: 0,
  updated_at: 7,
};

describe("rating reads", () => {
  it("GETs the player's rating row, never deviation or volatility", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: [ROW_BODY] });
    const result = await playerRating(fake.endpoint, TOKEN, PLAYER);
    expect(result).toEqual({
      ok: true,
      value: {
        rating: 1500.5,
        rankedGames: 2,
        lio: { wins: 1, losses: 0, draws: 0 },
        sae: { wins: 0, losses: 1, draws: 0 },
        updatedAt: 7,
      },
    });
    expect(fake.requests[0]?.url).toBe(
      `${LOBBY_URL}/rest/v1/rating?select=${[
        "rating",
        "ranked_games",
        "lio_wins",
        "lio_losses",
        "lio_draws",
        "sae_wins",
        "sae_losses",
        "sae_draws",
        "updated_at",
      ].join(",")}&player=eq.${PLAYER}`,
    );
    expect(fake.requests[0]?.headers.apikey).toBe(LOBBY_ANON_KEY);
  });
  it("no row is unrated (null), not an error", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: [] });
    expect(await playerRating(fake.endpoint, TOKEN, PLAYER)).toEqual({ ok: true, value: null });
  });
  it("a malformed row fails as network", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: [{ ...ROW_BODY, ranked_games: "2" }] });
    expect(await playerRating(fake.endpoint, TOKEN, PLAYER)).toEqual({ ok: false, error: { code: "network" } });
  });
  it("a signed-out caller is notSignedIn and a non-UUID id is badId, each without a request", async () => {
    const fake = createFakeLobby();
    expect(await playerRating(fake.endpoint, null, PLAYER)).toEqual({ ok: false, error: { code: "notSignedIn" } });
    expect(await playerRating(fake.endpoint, TOKEN, "x,y")).toEqual({ ok: false, error: { code: "badId" } });
    expect(await matchRatingChange(fake.endpoint, TOKEN, "m-1", "x,y")).toEqual({
      ok: false,
      error: { code: "badId" },
    });
    expect(fake.requests).toEqual([]);
  });
  it("reads the match's rating_change row, null while it is missing, network when malformed", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: [{ rating_before: 1500, rating_after: 1512.5, ranked_games: 3 }] });
    fake.answerNext({ status: 200, body: [] });
    fake.answerNext({ status: 200, body: [{ rating_before: "x", rating_after: 1, ranked_games: 3 }] });
    expect(await matchRatingChange(fake.endpoint, TOKEN, "m-1", PLAYER)).toEqual({
      ok: true,
      value: { before: 1500, after: 1512.5, rankedGames: 3 },
    });
    expect(fake.requests[0]?.url).toBe(
      `${LOBBY_URL}/rest/v1/rating_change?select=rating_before,rating_after,ranked_games&match_id=eq.m-1&player=eq.${PLAYER}`,
    );
    expect(await matchRatingChange(fake.endpoint, TOKEN, "m-1", PLAYER)).toEqual({ ok: true, value: null });
    expect(await matchRatingChange(fake.endpoint, TOKEN, "m-1", PLAYER)).toEqual({
      ok: false,
      error: { code: "network" },
    });
  });
  it("reads whether a match is ranked", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: [{ ranked: true }] });
    expect(await matchRanked(fake.endpoint, TOKEN, "m-1")).toEqual({ ok: true, value: true });
    expect(fake.requests[0]?.url).toBe(`${LOBBY_URL}/rest/v1/match?select=ranked&match_id=eq.m-1`);
  });
});
