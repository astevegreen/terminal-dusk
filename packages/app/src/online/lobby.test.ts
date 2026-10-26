import { describe, expect, it } from "vitest";
import type { MatchDeadline } from "@terminal-dusk/host";
import { createGame, joinGame, previewInvite } from "./lobby.ts";
import type { NewGame, SideMode } from "./lobby.ts";
import { LOBBY_ANON_KEY, LOBBY_URL, TOKEN, createFakeLobby } from "./test/fakeLobby.ts";

const INVITE_URL = `${LOBBY_URL}/functions/v1/invite`;
const POST_HEADERS = {
  apikey: LOBBY_ANON_KEY,
  Accept: "application/json",
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};
const GAME: NewGame = { sides: { mode: "random" }, deadline: { rule: "graceThenLoss", days: 3 }, platform: "web" };

describe("createGame", () => {
  it("POSTs action create with sides, deadline and platform to the invite function and returns the code", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: { ok: true, code: "K7Q2MX" } });
    const result = await createGame(fake.endpoint, TOKEN, GAME);
    expect(result).toEqual({ ok: true, value: "K7Q2MX" });
    expect(fake.requests).toEqual([
      {
        url: INVITE_URL,
        method: "POST",
        headers: POST_HEADERS,
        body: {
          action: "create",
          sides: { mode: "random" },
          deadline: { rule: "graceThenLoss", days: 3 },
          platform: "web",
        },
      },
    ]);
  });

  it.each<[SideMode, MatchDeadline]>([
    [
      { mode: "host", hostSide: "lio" },
      { rule: "lossOnTime", days: 1 },
    ],
    [
      { mode: "host", hostSide: "sae" },
      { rule: "graceThenLoss", days: 7 },
    ],
    [{ mode: "invitee" }, { rule: "lossOnTime", days: 3 }],
  ])("sends every side mode and deadline as given (%j, %j)", async (sides, deadline) => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: { ok: true, code: "ABCDEF" } });
    await createGame(fake.endpoint, TOKEN, { sides, deadline, platform: "steam" });
    expect(fake.requests[0]?.body).toEqual({ action: "create", sides, deadline, platform: "steam" });
  });

  it("a null token is refused as notSignedIn without a request", async () => {
    const fake = createFakeLobby();
    expect(await createGame(fake.endpoint, null, GAME)).toEqual({ ok: false, error: { code: "notSignedIn" } });
    expect(fake.requests).toEqual([]);
  });

  it.each<[string, unknown]>([
    ["an unknown side mode", { ...GAME, sides: { mode: "coinFlip" } }],
    ["a host mode without a side", { ...GAME, sides: { mode: "host" } }],
    ["an unknown deadline rule", { ...GAME, deadline: { rule: "never", days: 3 } }],
    ["a deadline of 2 days", { ...GAME, deadline: { rule: "lossOnTime", days: 2 } }],
    ["an unknown platform", { ...GAME, platform: "xbox" }],
  ])("bad inputs send nothing: %s is refused as invalidInvite", async (_name, game) => {
    const fake = createFakeLobby();
    const result = await createGame(fake.endpoint, TOKEN, game as NewGame);
    expect(result).toEqual({ ok: false, error: { code: "invalidInvite" } });
    expect(fake.requests).toEqual([]);
  });

  it("a 200 without a code is malformed and fails as network", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: { ok: true } });
    expect(await createGame(fake.endpoint, TOKEN, GAME)).toEqual({ ok: false, error: { code: "network" } });
  });
});

describe("previewInvite", () => {
  it("returns the invite's sides, sending the code trimmed and upper-cased", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "host", hostSide: "sae" } } });
    const result = await previewInvite(fake.endpoint, TOKEN, "  k7q2mx \n");
    expect(result).toEqual({ ok: true, value: { mode: "host", hostSide: "sae" } });
    expect(fake.requests).toEqual([
      { url: INVITE_URL, method: "POST", headers: POST_HEADERS, body: { action: "preview", code: "K7Q2MX" } },
    ]);
  });

  it.each(["", "   ", "\t\n"])("an empty code (%j) is refused as inviteNotFound before any request", async (code) => {
    const fake = createFakeLobby();
    expect(await previewInvite(fake.endpoint, TOKEN, code)).toEqual({ ok: false, error: { code: "inviteNotFound" } });
    expect(fake.requests).toEqual([]);
  });

  it("a null token is refused as notSignedIn without a request", async () => {
    const fake = createFakeLobby();
    expect(await previewInvite(fake.endpoint, null, "K7Q2MX")).toEqual({ ok: false, error: { code: "notSignedIn" } });
    expect(fake.requests).toEqual([]);
  });

  it("a 200 with sides that are not a side mode fails as network", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "host", hostSide: "both" } } });
    expect(await previewInvite(fake.endpoint, TOKEN, "K7Q2MX")).toEqual({ ok: false, error: { code: "network" } });
  });
});

describe("joinGame", () => {
  it("returns { matchId, side } and sends no side when none is given", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: { ok: true, matchId: "m-1", side: "lio" } });
    const result = await joinGame(fake.endpoint, TOKEN, " ab12cd ");
    expect(result).toEqual({ ok: true, value: { matchId: "m-1", side: "lio" } });
    expect(fake.requests).toEqual([
      { url: INVITE_URL, method: "POST", headers: POST_HEADERS, body: { action: "join", code: "AB12CD" } },
    ]);
    expect(fake.requests[0]?.body).not.toHaveProperty("side");
  });

  it("sends side only when given", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: { ok: true, matchId: "m-2", side: "sae" } });
    const result = await joinGame(fake.endpoint, TOKEN, "AB12CD", "sae");
    expect(result).toEqual({ ok: true, value: { matchId: "m-2", side: "sae" } });
    expect(fake.requests[0]?.body).toEqual({ action: "join", code: "AB12CD", side: "sae" });
  });

  it("an empty code is refused as inviteNotFound before any request", async () => {
    const fake = createFakeLobby();
    expect(await joinGame(fake.endpoint, TOKEN, "  ")).toEqual({ ok: false, error: { code: "inviteNotFound" } });
    expect(fake.requests).toEqual([]);
  });

  it("bad inputs send nothing: a side that is not lio or sae is refused as illegalSide", async () => {
    const fake = createFakeLobby();
    const result = await joinGame(fake.endpoint, TOKEN, "AB12CD", "both" as "lio");
    expect(result).toEqual({ ok: false, error: { code: "illegalSide" } });
    expect(fake.requests).toEqual([]);
  });

  it("a null token is refused as notSignedIn without a request", async () => {
    const fake = createFakeLobby();
    expect(await joinGame(fake.endpoint, null, "AB12CD")).toEqual({ ok: false, error: { code: "notSignedIn" } });
    expect(fake.requests).toEqual([]);
  });

  it("a 200 without a valid side fails as network", async () => {
    const fake = createFakeLobby();
    fake.answerNext({ status: 200, body: { ok: true, matchId: "m-1", side: "LIO" } });
    expect(await joinGame(fake.endpoint, TOKEN, "AB12CD")).toEqual({ ok: false, error: { code: "network" } });
  });
});
