import { describe, expect, it } from "vitest";
import { OTHER, PLAYER, TOKEN, refusalBody } from "./test/fakeLobby.ts";
import { lobbyRig, matchRow, startedRig } from "./test/lobbyRig.ts";

const body = (r: ReturnType<typeof lobbyRig>, i: number): unknown => r.fake.requests[i]?.body;
const okGames = (rows: unknown[] = []) => ({ status: 200, body: rows }) as const;

describe("the lobby session's first snapshot", () => {
  it("preselects random sides, 3 days and one extra deadline, with My games loading", () => {
    const s = lobbyRig().lobby.getSnapshot();
    expect(s.sides).toEqual({ mode: "random" });
    expect(s.deadline).toEqual({ rule: "graceThenLoss", days: 3 });
    expect(s.create).toEqual({ busy: false, code: null, refusal: null });
    expect(s.join).toEqual({ busy: false, askSide: null, joined: null, refusal: null });
    expect(s.games).toEqual({ busy: false, list: null, refusal: null });
  });
});

describe("My games", () => {
  it("is read when the lobby opens, newest first", async () => {
    const r = lobbyRig();
    r.fake.answerNext(okGames([matchRow({ match_id: "old", updated_at: 1 }), matchRow({ match_id: "new" })]));
    const starting = r.lobby.start();
    expect(r.lobby.getSnapshot().games.busy).toBe(true);
    await starting;
    expect(r.fake.requests[0]?.url).toContain("/rest/v1/match?");
    expect(r.lobby.getSnapshot().games.list?.map((g) => g.matchId)).toEqual(["new", "old"]);
    expect(r.lobby.getSnapshot().games.busy).toBe(false);
  });
  it("start reads the list only once", async () => {
    const r = await startedRig();
    await r.lobby.start();
    expect(r.fake.requests).toHaveLength(1);
  });
  it("Refresh reads it again", async () => {
    const r = await startedRig();
    r.fake.answerNext(okGames([matchRow()]));
    await r.lobby.refresh();
    expect(r.fake.requests).toHaveLength(2);
    expect(r.lobby.getSnapshot().games.list).toHaveLength(1);
  });
  it("a failed read shows its refusal in My games only", async () => {
    const r = lobbyRig();
    r.fake.answerNext("throw");
    await r.lobby.start();
    const s = r.lobby.getSnapshot();
    expect(s.games).toEqual({ busy: false, list: null, refusal: "network" });
    expect(s.create.refusal).toBeNull();
    expect(s.join.refusal).toBeNull();
  });
  it("a failed read never hides an invite code just created", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, code: "ABC123" } });
    await r.lobby.create();
    r.fake.answerNext({ status: 503, body: {} });
    await r.lobby.refresh();
    expect(r.lobby.getSnapshot().create.code).toBe("ABC123");
    expect(r.lobby.getSnapshot().games.refusal).toBe("network");
  });
  it("only the newest read changes the list", async () => {
    const r = await startedRig();
    let release = (): void => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const fetch = r.fake.endpoint.fetch;
    let first = true;
    r.fake.endpoint.fetch = async (url, init) => {
      const reply = await fetch(url, init);
      if (first) {
        first = false;
        await held;
      }
      return reply;
    };
    r.fake.answerNext(okGames([matchRow({ match_id: "stale" })]));
    const older = r.lobby.refresh();
    r.fake.answerNext(okGames([matchRow({ match_id: "fresh" })]));
    await r.lobby.refresh();
    release();
    await older;
    expect(r.lobby.getSnapshot().games.list?.map((g) => g.matchId)).toEqual(["fresh"]);
  });
});

describe("New game choices", () => {
  it("keeps each picked side mode, length and rule", () => {
    const r = lobbyRig();
    r.lobby.chooseSides({ mode: "host", hostSide: "sae" });
    r.lobby.chooseDays(7);
    r.lobby.chooseRule("lossOnTime");
    const s = r.lobby.getSnapshot();
    expect(s.sides).toEqual({ mode: "host", hostSide: "sae" });
    expect(s.deadline).toEqual({ rule: "lossOnTime", days: 7 });
    r.lobby.chooseSides({ mode: "invitee" });
    expect(r.lobby.getSnapshot().sides).toEqual({ mode: "invitee" });
  });
});

describe("create", () => {
  it("calls createGame with the choices and platform web, then shows the code", async () => {
    const r = await startedRig();
    r.lobby.chooseSides({ mode: "host", hostSide: "lio" });
    r.lobby.chooseDays(1);
    r.fake.answerNext({ status: 200, body: { ok: true, code: "ABC123" } });
    const creating = r.lobby.create();
    expect(r.lobby.getSnapshot().create.busy).toBe(true);
    await creating;
    expect(body(r, 1)).toEqual({
      action: "create",
      sides: { mode: "host", hostSide: "lio" },
      deadline: { rule: "graceThenLoss", days: 1 },
      platform: "web",
    });
    expect(r.lobby.getSnapshot().create).toEqual({ busy: false, code: "ABC123", refusal: null });
  });
  it("does not read My games again, since no game exists until the friend joins", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, code: "ABC123" } });
    await r.lobby.create();
    expect(r.fake.requests).toHaveLength(2);
  });
  it("a notEntitled refusal shows in New game and leaves Join usable", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 403, body: refusalBody("notEntitled") });
    await r.lobby.create();
    const s = r.lobby.getSnapshot();
    expect(s.create).toEqual({ busy: false, code: null, refusal: "notEntitled" });
    expect(s.join.busy).toBe(false);
    expect(s.join.refusal).toBeNull();
  });
  it("with no token it is refused as notSignedIn without a request", async () => {
    const r = lobbyRig(null);
    await r.lobby.create();
    expect(r.fake.requests).toHaveLength(0);
    expect(r.lobby.getSnapshot().create.refusal).toBe("notSignedIn");
  });
  it("ignores a second create while one is in flight", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, code: "ABC123" } });
    const first = r.lobby.create();
    await r.lobby.create();
    await first;
    expect(r.fake.requests).toHaveLength(2);
  });
  it("Copy hands the shown code to the copy function", async () => {
    const r = await startedRig();
    await r.lobby.copyCode();
    expect(r.copied).toEqual([]);
    r.fake.answerNext({ status: 200, body: { ok: true, code: "ABC123" } });
    await r.lobby.create();
    await r.lobby.copyCode();
    expect(r.copied).toEqual(["ABC123"]);
  });
});

describe("join", () => {
  it("previews, then joins at once when the invite fixes the sides, says the side and reads My games", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "random" } } });
    r.fake.answerNext({ status: 200, body: { ok: true, matchId: "m-9", side: "sae" } });
    r.fake.answerNext(okGames([matchRow({ match_id: "m-9", lio_player: OTHER, sae_player: PLAYER })]));
    await r.lobby.join(" abc123 ");
    expect(body(r, 1)).toEqual({ action: "preview", code: "ABC123" });
    expect(body(r, 2)).toEqual({ action: "join", code: "ABC123" });
    expect(r.fake.requests[3]?.url).toContain("/rest/v1/match?");
    const s = r.lobby.getSnapshot();
    expect(s.join).toEqual({ busy: false, askSide: null, joined: { matchId: "m-9", side: "sae" }, refusal: null });
    expect(s.games.list?.map((g) => g.matchId)).toEqual(["m-9"]);
  });
  it("asks LIO or SAE when the invite lets the joiner pick, then joins the previewed code with that side", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
    await r.lobby.join("abc123");
    expect(r.lobby.getSnapshot().join).toEqual({ busy: false, askSide: "ABC123", joined: null, refusal: null });
    expect(r.fake.requests).toHaveLength(2);
    r.fake.answerNext({ status: 200, body: { ok: true, matchId: "m-9", side: "lio" } });
    r.fake.answerNext(okGames());
    await r.lobby.pickSide("lio");
    expect(body(r, 2)).toEqual({ action: "join", code: "ABC123", side: "lio" });
    expect(r.lobby.getSnapshot().join).toEqual({
      busy: false,
      askSide: null,
      joined: { matchId: "m-9", side: "lio" },
      refusal: null,
    });
  });
  it("changing the code field clears the side question", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
    await r.lobby.join("abc123");
    r.lobby.codeChanged();
    expect(r.lobby.getSnapshot().join.askSide).toBeNull();
    await r.lobby.pickSide("sae");
    expect(r.fake.requests).toHaveLength(2);
  });
  it("a join refusal such as ownInvite clears the side question and shows the refusal", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
    await r.lobby.join("abc123");
    r.fake.answerNext({ status: 409, body: refusalBody("ownInvite") });
    await r.lobby.pickSide("sae");
    expect(r.lobby.getSnapshot().join).toEqual({ busy: false, askSide: null, joined: null, refusal: "ownInvite" });
    expect(r.fake.requests).toHaveLength(3);
  });
  it("a preview refusal shows and nothing is joined", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 404, body: refusalBody("inviteNotFound") });
    await r.lobby.join("nope");
    expect(r.lobby.getSnapshot().join).toEqual({
      busy: false,
      askSide: null,
      joined: null,
      refusal: "inviteNotFound",
    });
    expect(r.fake.requests).toHaveLength(2);
  });
  it("a refused direct join shows its refusal and does not read My games", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "random" } } });
    r.fake.answerNext({ status: 429, body: {} });
    await r.lobby.join("abc123");
    expect(r.lobby.getSnapshot().join.refusal).toBe("tooManyRequests");
    expect(r.fake.requests).toHaveLength(3);
  });
  it("is busy while in flight and ignores a second join", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 404, body: refusalBody("inviteNotFound") });
    const first = r.lobby.join("abc123");
    expect(r.lobby.getSnapshot().join.busy).toBe(true);
    await r.lobby.join("other");
    await first;
    expect(r.fake.requests).toHaveLength(2);
  });
  it("a new join clears the last joined line and refusal", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 404, body: refusalBody("inviteNotFound") });
    await r.lobby.join("abc123");
    const joining = r.lobby.join("abc124");
    expect(r.lobby.getSnapshot().join.refusal).toBeNull();
    await joining;
  });
});

describe("secrets", () => {
  it("no snapshot ever holds the token", async () => {
    const r = await startedRig([matchRow()]);
    r.fake.answerNext({ status: 403, body: refusalBody("notEntitled") });
    await r.lobby.create();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
    await r.lobby.join("abc123");
    r.fake.answerNext({ status: 409, body: refusalBody("ownInvite") });
    await r.lobby.pickSide("lio");
    expect(r.seen.length).toBeGreaterThan(5);
    for (const s of r.seen) expect(JSON.stringify(s)).not.toContain(TOKEN);
  });
});
