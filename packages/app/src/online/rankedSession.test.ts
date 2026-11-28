import { describe, expect, it } from "vitest";
import { LOBBY_REFUSAL } from "./lobbyText.ts";
import { OTHER, PLAYER, refusalBody } from "./test/fakeLobby.ts";
import { matchRow } from "./test/lobbyRig.ts";
import { TICKET, rankedRig, searchingRig } from "./test/rankedRig.ts";

const seekRow = { id: TICKET, preset: "fast", side: "sae" };
const newGame = matchRow({ match_id: "m-new", sae_player: PLAYER, lio_player: OTHER });

describe("the ranked search: the form", () => {
  it("starts on the normal preset with no side preference", () => {
    const s = rankedRig().ranked.getSnapshot();
    expect([s.preset, s.side, s.phase]).toEqual(["normal", null, "form"]);
  });

  it("sends the chosen preset and side to the seek function, with the platform, and shows Searching", async () => {
    const r = rankedRig();
    r.ranked.choosePreset("slow");
    r.ranked.chooseSide("lio");
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 200, body: { ok: true, ticketId: TICKET } });
    await r.ranked.search();
    const post = r.fake.requests[1]!;
    expect(post.url).toMatch(/\/functions\/v1\/seek$/);
    expect(post.body).toEqual({ action: "create", preset: "slow", side: "lio", platform: "web" });
    expect(r.ranked.getSnapshot().phase).toBe("searching");
  });

  it("tells a free player why, by the server's notEntitled", async () => {
    const r = rankedRig();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 403, body: refusalBody("notEntitled") });
    await r.ranked.search();
    expect(r.ranked.getSnapshot()).toMatchObject({ phase: "form", refusal: "notEntitled", busy: false });
  });

  it("shows the refusal at 5 games in words, not a code", async () => {
    const r = rankedRig();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 409, body: refusalBody("limitReached") });
    await r.ranked.search();
    const code = r.ranked.getSnapshot().refusal!;
    expect(code).toBe("limitReached");
    expect(LOBBY_REFUSAL[code]).toContain("5 ranked games");
  });

  it("changes nothing while a search is open", async () => {
    const r = await searchingRig();
    r.ranked.choosePreset("fast");
    expect(r.ranked.getSnapshot().preset).toBe("normal");
  });
});

describe("the ranked search: searching, cancelling and starting", () => {
  it("cancel ends the search on the server and shows the form again", async () => {
    const r = await searchingRig();
    r.fake.answerNext({ status: 200, body: { ok: true } });
    await r.ranked.cancel();
    expect(r.fake.requests.at(-1)!.body).toEqual({ action: "cancel", ticketId: TICKET });
    expect(r.ranked.getSnapshot().phase).toBe("form");
  });

  it("keeps searching when the cancel fails, and says so", async () => {
    const r = await searchingRig();
    r.fake.answerNext("throw");
    await r.ranked.cancel();
    expect(r.ranked.getSnapshot()).toMatchObject({ phase: "searching", refusal: "network" });
  });

  it("keeps searching while the ticket is still open", async () => {
    const r = await searchingRig();
    r.fake.answerNext({
      status: 200,
      body: [seekRow, { ...seekRow, id: "other" }].slice(0, 1).map((x) => ({ ...x, id: TICKET })),
    });
    await r.ranked.poll();
    expect(r.ranked.getSnapshot().phase).toBe("searching");
  });

  it("shows the started match once the ticket is gone and a new game is among My games", async () => {
    const r = await searchingRig();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 200, body: [newGame] });
    await r.ranked.poll();
    const s = r.ranked.getSnapshot();
    expect(s.phase).toBe("started");
    expect(s.started).toMatchObject({ matchId: "m-new", mySide: "sae" });
  });

  it("does not mistake a game the player already had for the new one", async () => {
    const r = rankedRig();
    r.fake.answerNext({ status: 200, body: [matchRow({ match_id: "old" })] });
    r.fake.answerNext({ status: 200, body: { ok: true, ticketId: TICKET } });
    await r.ranked.search();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 200, body: [matchRow({ match_id: "old" })] });
    await r.ranked.poll();
    expect(r.ranked.getSnapshot().phase).toBe("form");
  });

  it("keeps searching when a poll cannot reach the server", async () => {
    const r = await searchingRig();
    r.fake.answerNext("throw");
    await r.ranked.poll();
    expect(r.ranked.getSnapshot()).toMatchObject({ phase: "searching", refusal: null });
  });

  it("shows a search left open by an earlier visit, with its choices", async () => {
    const r = rankedRig();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 200, body: [seekRow] });
    await r.ranked.start();
    expect(r.ranked.getSnapshot()).toMatchObject({ phase: "searching", preset: "fast", side: "sae" });
  });

  it("reads My games before the open searches, so a game paired in between is not counted as known", async () => {
    const r = rankedRig();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 200, body: [seekRow] });
    await r.ranked.start();
    expect(r.fake.requests[0]!.url).toContain("/match?");
    expect(r.fake.requests[1]!.url).toContain("seek?");
  });

  it("says so, and does not show a blank form, when the search cannot be read", async () => {
    const r = rankedRig();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext("throw");
    await r.ranked.start();
    expect(r.ranked.getSnapshot()).toMatchObject({ phase: "form", busy: false, refusal: "network" });
  });

  it("says so when My games cannot be read at the start", async () => {
    const r = rankedRig();
    r.fake.answerNext("throw");
    r.fake.answerNext({ status: 200, body: [seekRow] });
    await r.ranked.start();
    expect(r.ranked.getSnapshot()).toMatchObject({ phase: "form", busy: false, refusal: "network" });
  });

  it("shows the form when no search is open, and reads the player's own rows only", async () => {
    const r = rankedRig();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 200, body: [] });
    await r.ranked.start();
    expect(r.ranked.getSnapshot().phase).toBe("form");
    expect(r.fake.requests[1]!.url).toContain(`seek?select=id,preset,side&player=eq.${PLAYER}`);
  });

  it("shows the new game when the cancel meets a search that was just paired", async () => {
    const r = await searchingRig();
    r.fake.answerNext({ status: 404, body: refusalBody("ticketNotFound") });
    r.fake.answerNext({ status: 200, body: [newGame] });
    await r.ranked.cancel();
    expect(r.ranked.getSnapshot()).toMatchObject({ phase: "started", started: { matchId: "m-new" } });
  });

  it("keeps Search locked until My games has been checked after a cancel that met a paired search", async () => {
    const r = await searchingRig();
    r.fake.answerNext({ status: 404, body: refusalBody("ticketNotFound") });
    r.fake.answerNext({ status: 200, body: [newGame] });
    const before = r.seen.length;
    await r.ranked.cancel();
    const steps = r.seen.slice(before);
    // Never the idle form in between: Search could be pressed there.
    expect(steps.some((x) => x.phase === "form" && !x.busy)).toBe(false);
    expect(steps.at(-1)).toMatchObject({ busy: false, phase: "started" });
  });

  it("again returns from a started game to the form", async () => {
    const r = await searchingRig();
    r.fake.answerNext({ status: 200, body: [] });
    r.fake.answerNext({ status: 200, body: [newGame] });
    await r.ranked.poll();
    r.ranked.again();
    expect(r.ranked.getSnapshot()).toMatchObject({ phase: "form", started: null });
  });
});
