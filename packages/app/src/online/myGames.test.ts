import { describe, expect, it } from "vitest";
import { MY_GAMES_COLUMNS, myGames } from "./myGames.ts";
import { LOBBY_ANON_KEY, LOBBY_URL, OTHER, PLAYER, TOKEN, createFakeLobby } from "./test/fakeLobby.ts";

const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  match_id: "m-1",
  lio_player: PLAYER,
  sae_player: OTHER,
  status: { kind: "active" },
  updated_at: 100,
  ...over,
});

describe("myGames", () => {
  it("GETs /rest/v1/match for the player's seats, selecting only the five columns, newest first", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: [] });
    expect(await myGames(fake.endpoint, TOKEN, PLAYER)).toEqual({ ok: true, value: [] });
    expect(fake.requests).toEqual([
      {
        url:
          `${LOBBY_URL}/rest/v1/match?select=match_id,lio_player,sae_player,status,updated_at` +
          `&or=(lio_player.eq.${PLAYER},sae_player.eq.${PLAYER})&order=updated_at.desc`,
        method: "GET",
        headers: { apikey: LOBBY_ANON_KEY, Accept: "application/json", Authorization: `Bearer ${TOKEN}` },
        body: undefined,
      },
    ]);
  });

  it("the select is seed-free", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: [] });
    await myGames(fake.endpoint, TOKEN, PLAYER);
    const select = new URL(fake.requests[0]?.url ?? "").searchParams.get("select");
    expect(select).toBe(MY_GAMES_COLUMNS);
    expect(select?.split(",")).toEqual(["match_id", "lio_player", "sae_player", "status", "updated_at"]);
    expect(fake.requests[0]?.url).not.toContain("seed");
  });

  it("returns { matchId, mySide, status, updatedAt } for each row, newest updatedAt first", async () => {
    const fake = createFakeLobby();
    fake.answerNext({
      status: 200,
      body: [
        row({ match_id: "m-old", updated_at: 5 }),
        row({ match_id: "m-new", lio_player: OTHER, sae_player: PLAYER, updated_at: 9 }),
        row({ match_id: "m-over", status: { kind: "over", winner: null, reason: "draw" }, updated_at: 7 }),
      ],
    });
    expect(await myGames(fake.endpoint, TOKEN, PLAYER)).toEqual({
      ok: true,
      value: [
        { matchId: "m-new", mySide: "sae", status: { kind: "active" }, updatedAt: 9 },
        { matchId: "m-over", mySide: "lio", status: { kind: "over", winner: null, reason: "draw" }, updatedAt: 7 },
        { matchId: "m-old", mySide: "lio", status: { kind: "active" }, updatedAt: 5 },
      ],
    });
  });

  it("a finished game keeps its winner and reason", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: [row({ status: { kind: "over", winner: "sae", reason: "time" } })] });
    const result = await myGames(fake.endpoint, TOKEN, PLAYER);
    expect(result.ok && result.value[0]?.status).toEqual({ kind: "over", winner: "sae", reason: "time" });
  });

  it("a null token is refused as notSignedIn without a request", async () => {
    const fake = createFakeLobby();
    expect(await myGames(fake.endpoint, null, PLAYER)).toEqual({ ok: false, error: { code: "notSignedIn" } });
    expect(fake.requests).toEqual([]);
  });

  it.each(["", "player-1", `${PLAYER},sae_player.neq.x`, `${PLAYER})`, " 11111111-2222-4333-8444-555555555555"])(
    "bad inputs send nothing: a playerId that is not a UUID (%j) is refused as notSignedIn",
    async (playerId) => {
      const fake = createFakeLobby();
      expect(await myGames(fake.endpoint, TOKEN, playerId)).toEqual({ ok: false, error: { code: "notSignedIn" } });
      expect(fake.requests).toEqual([]);
    },
  );

  it.each<[string, unknown]>([
    ["a reply that is not a list", { rows: [] }],
    ["a row that is not an object", [row(), "m-2"]],
    ["a missing match_id", [row({ match_id: undefined })]],
    ["a numeric match_id", [row({ match_id: 7 })]],
    ["a missing lio_player", [row({ lio_player: undefined })]],
    ["a null sae_player", [row({ sae_player: null })]],
    ["an updated_at that is a string", [row({ updated_at: "2026-10-25" })]],
    ["an updated_at that is not a whole number", [row({ updated_at: 1.5 })]],
    ["a missing status", [row({ status: undefined })]],
    ["a status of an unknown kind", [row({ status: { kind: "paused" } })]],
    ["an over status without a reason", [row({ status: { kind: "over", winner: "lio" } })]],
    ["an over status without a winner", [row({ status: { kind: "over", reason: "time" } })]],
    ["an over status with an unknown winner", [row({ status: { kind: "over", winner: "LIO", reason: "time" } })]],
    ["a row where neither seat is the player", [row(), row({ lio_player: OTHER, sae_player: OTHER })]],
  ])("a malformed row makes the whole call fail as network: %s", async (_case, body) => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body });
    expect(await myGames(fake.endpoint, TOKEN, PLAYER)).toEqual({ ok: false, error: { code: "network" } });
  });
});
