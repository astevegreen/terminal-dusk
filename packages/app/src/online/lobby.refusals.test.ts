import { describe, expect, it } from "vitest";
import { createGame, joinGame, previewInvite } from "./lobby.ts";
import type { LobbyEndpoint, LobbyResult } from "./lobbyHttp.ts";
import { myGames } from "./myGames.ts";
import { PLAYER, TOKEN, createFakeLobby, refusalBody } from "./test/fakeLobby.ts";
import type { LobbyAnswer } from "./test/fakeLobby.ts";

type Call = (e: LobbyEndpoint) => Promise<LobbyResult<unknown>>;

const CALLS: [string, Call][] = [
  [
    "createGame",
    (e) =>
      createGame(e, TOKEN, { sides: { mode: "random" }, deadline: { rule: "lossOnTime", days: 1 }, platform: "web" }),
  ],
  ["previewInvite", (e) => previewInvite(e, TOKEN, "K7Q2MX")],
  ["joinGame", (e) => joinGame(e, TOKEN, "K7Q2MX")],
  ["myGames", (e) => myGames(e, TOKEN, PLAYER)],
];

/** Each server code with the status the invite function sends it with. */
const SERVER_REFUSALS: [string, number][] = [
  ["notEntitled", 403],
  ["inviteNotFound", 404],
  ["ownInvite", 409],
  ["sideRequired", 422],
  ["sideNotChoosable", 422],
  ["illegalSide", 422],
  ["invalidInvite", 422],
];

const run = async (call: Call, answer: LobbyAnswer): Promise<LobbyResult<unknown>> => {
  const fake = createFakeLobby();
  fake.answerNext(answer);
  return call(fake.endpoint);
};

describe.each(CALLS)("%s refusals", (_name, call) => {
  it.each<[string, LobbyAnswer]>([
    ["the invite function's own 401", { status: 401, body: refusalBody("notSignedIn") }],
    [
      "the REST gateway's 401 for an expired token",
      { status: 401, body: { code: "PGRST301", message: "JWT expired" } },
    ],
    ["a 401 with an unreadable body", { status: 401, unreadable: true }],
  ])("any 401 is notSignedIn: %s", async (_case, answer) => {
    expect(await run(call, answer)).toEqual({ ok: false, error: { code: "notSignedIn" } });
  });

  it.each(SERVER_REFUSALS)("passes on the server's own code %s", async (code, status) => {
    expect(await run(call, { status, body: refusalBody(code) })).toEqual({ ok: false, error: { code } });
  });

  it("a free player's notEntitled comes back as notEntitled", async () => {
    expect(await run(call, { status: 403, body: refusalBody("notEntitled") })).toEqual({
      ok: false,
      error: { code: "notEntitled" },
    });
  });

  it("429 is tooManyRequests", async () => {
    expect(await run(call, { status: 429, body: { message: "slow down" } })).toEqual({
      ok: false,
      error: { code: "tooManyRequests" },
    });
  });

  it.each<[string, LobbyAnswer]>([
    ["a thrown fetch", "throw"],
    ["a 500", { status: 500, body: refusalBody("internalError") }],
    ["a 503 with an unreadable body", { status: 503, unreadable: true }],
    ["a 200 with an unreadable body", { status: 200, unreadable: true }],
    ["a 400 with a code the lobby does not know", { status: 400, body: refusalBody("illegalAnswer") }],
    ["a 404 with no body to speak of", { status: 404, body: null }],
  ])("network for %s", async (_case, answer) => {
    expect(await run(call, answer)).toEqual({ ok: false, error: { code: "network" } });
  });

  it("no result carries the server's message text or the token", async () => {
    const results = await Promise.all(
      [...SERVER_REFUSALS.map(([code, status]) => ({ status, body: refusalBody(code) })), "throw" as const].map(
        (answer) => run(call, answer),
      ),
    );
    const text = JSON.stringify(results);
    expect(text).not.toContain("Server says");
    expect(text).not.toContain(TOKEN);
  });
});
