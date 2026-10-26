// The wiring from the lobby to an online game: Open in My games and a successful join open the game for that
// match id, Back closes it and reads My games again, and the session is built with the setup's project, the
// sign-in's token, the clock and the timers passed in (fake ones here, so no real poll ever waits).
import { isValidElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../platform/storage.ts";
import { cardName, cardQuestion } from "../testMode/fixture.ts";
import { ANON_KEY, URL_BASE } from "../transport/test/fakeSupabase.ts";
import { config, fakeTimers, rig as transportRig, settle } from "../transport/test/remoteGame.ts";
import { createOnlineGame, DEFAULT_POLL_MS } from "./onlineGame.ts";
import type { OnlineGame } from "./onlineGame.ts";
import { OnlineGameFlow, onlineGameOptions, openGame } from "./OnlineGameScreen.tsx";
import type { PlaySetup } from "./OnlineGameScreen.tsx";
import { backToLobby, lobbyStep, openingActions } from "./OnlineScreen.tsx";
import type { OnlineSetup } from "./OnlineScreen.tsx";
import { LobbyView } from "./LobbyView.tsx";
import { createFakeLobby } from "./test/fakeLobby.ts";
import { matchRow, startedRig } from "./test/lobbyRig.ts";
import { button, treeOf } from "./test/screenTree.ts";
import { STORED, rigWith } from "./test/signInRig.ts";

const play = (timers = fakeTimers()): PlaySetup => ({
  clock: () => 123,
  timers,
  label: cardName,
  question: cardQuestion,
});
const setup = (): OnlineSetup => {
  const fake = createFakeLobby();
  return { auth: fake.endpoint, store: memoryStore(), platform: "web", copy: () => {} };
};

describe("opening a game from the lobby", () => {
  it("a join that succeeds opens its game at once, pressed through the lobby screen", async () => {
    const r = await startedRig();
    const opened: string[] = [];
    const actions = openingActions(r.lobby, (id) => opened.push(id));
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "random" } } });
    r.fake.answerNext({ status: 200, body: { ok: true, matchId: "m-9", side: "sae" } });
    r.fake.answerNext({ status: 200, body: [] });
    const t = treeOf(
      <LobbyView
        snapshot={r.lobby.getSnapshot()}
        actions={actions}
        onSignOut={() => {}}
        onBack={() => {}}
        onOpen={(id) => opened.push(id)}
      />,
    );
    t.forms[0]!.submit({ code: "abc123" });
    await settle();
    expect(opened).toEqual(["m-9"]);
  });
  it("a join after picking a side opens its game too", async () => {
    const r = await startedRig();
    const opened: string[] = [];
    const actions = openingActions(r.lobby, (id) => opened.push(id));
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
    await actions.join("abc123");
    expect(opened).toEqual([]);
    r.fake.answerNext({ status: 200, body: { ok: true, matchId: "m-4", side: "lio" } });
    r.fake.answerNext({ status: 200, body: [] });
    await actions.pickSide("lio");
    expect(opened).toEqual(["m-4"]);
  });
  it("a refused join opens nothing", async () => {
    const r = await startedRig();
    const opened: string[] = [];
    r.fake.answerNext({ status: 404, body: { ok: false, error: { code: "inviteNotFound" } } });
    await openingActions(r.lobby, (id) => opened.push(id)).join("nope");
    expect(r.lobby.getSnapshot().join.refusal).toBe("inviteNotFound");
    expect(opened).toEqual([]);
  });
  it("the other lobby actions reach the lobby session unchanged", async () => {
    const r = await startedRig();
    const actions = openingActions(r.lobby, () => {});
    actions.chooseDays(7);
    actions.chooseRule("lossOnTime");
    actions.chooseSides({ mode: "invitee" });
    const s = r.lobby.getSnapshot();
    expect(s.deadline).toEqual({ rule: "lossOnTime", days: 7 });
    expect(s.sides).toEqual({ mode: "invitee" });
  });
});

describe("lobbyStep", () => {
  it("with a game open, shows the online game screen for that match id, keyed by it", async () => {
    const r = await startedRig();
    const signIn = (await rigWith(STORED)).signIn;
    const online = setup();
    const p = play();
    const step = lobbyStep({
      online,
      signIn,
      play: p,
      onBack: () => {},
      playerId: "user-1",
      lobby: r.lobby,
      open: "m-7",
      show: () => {},
    });
    expect(isValidElement(step)).toBe(true);
    expect(step.type).toBe(OnlineGameFlow);
    expect(step.key).toBe("m-7");
    expect(step.props).toMatchObject({ auth: online.auth, signIn, playerId: "user-1", matchId: "m-7", play: p });
  });
  it("Back from the game returns to the lobby, which reads My games again", async () => {
    const r = await startedRig();
    const shown: (string | null)[] = [];
    const reads = r.fake.requests.length;
    const step = lobbyStep({
      online: setup(),
      signIn: (await rigWith(STORED)).signIn,
      play: play(),
      onBack: () => {},
      playerId: "user-1",
      lobby: r.lobby,
      open: "m-7",
      show: (id) => shown.push(id),
    });
    r.fake.answerNext({ status: 200, body: [] });
    (step.props as { onBack: () => void }).onBack();
    await settle();
    expect(shown).toEqual([null]);
    expect(r.fake.requests.length).toBe(reads + 1);
    expect(r.fake.requests.at(-1)?.url).toContain("/rest/v1/match");
  });
  it("with no game open, shows the lobby, whose Open shows the game", async () => {
    const r = await startedRig();
    const show = (): void => {};
    const step = lobbyStep({
      online: setup(),
      signIn: (await rigWith(STORED)).signIn,
      play: play(),
      onBack: () => {},
      playerId: "user-1",
      lobby: r.lobby,
      open: null,
      show,
    });
    expect(step.type).not.toBe(OnlineGameFlow);
    expect((step.props as { onOpen: unknown }).onOpen).toBe(show);
  });
  it("backToLobby shows the lobby and reads My games again", async () => {
    const r = await startedRig();
    const shown: (string | null)[] = [];
    r.fake.answerNext({ status: 200, body: [] });
    const reads = r.fake.requests.length;
    backToLobby(r.lobby, (id) => shown.push(id));
    await settle();
    expect(shown).toEqual([null]);
    expect(r.fake.requests.length).toBe(reads + 1);
  });
});

describe("the online game session's setup", () => {
  it("uses the setup's project, the sign-in's token, the clock and the timers passed in", async () => {
    const timers = fakeTimers();
    const p = play(timers);
    const auth = { url: URL_BASE, anonKey: ANON_KEY, fetch: transportRig().fake.fetch };
    const signIn = { accessToken: () => Promise.resolve("token-alice") };
    const options = onlineGameOptions(auth, signIn, "alice", config.matchId, p);
    expect(options).toMatchObject({ url: URL_BASE, anonKey: ANON_KEY, matchId: config.matchId, playerId: "alice" });
    expect(options.fetch).toBe(auth.fetch);
    expect(options.now).toBe(p.clock);
    expect(options.timers).toBe(timers);
    expect(await options.accessToken()).toBe("token-alice");
    const game = createOnlineGame(options);
    await settle();
    expect(game.getSnapshot().turn).toBe("mine");
    expect(timers.waiting()).toEqual([DEFAULT_POLL_MS]); // the fake timers poll, so no real wait
    game.close();
  });
  it("openGame shows the session it starts and closes it on clean-up", () => {
    let closed = 0;
    const made = { close: () => void closed++ } as unknown as OnlineGame;
    const seen: OnlineGame[] = [];
    const cleanUp = openGame(
      () => made,
      (g) => seen.push(g),
    );
    expect(seen).toEqual([made]);
    expect(closed).toBe(0);
    cleanUp();
    expect(closed).toBe(1);
  });
  it("the online game screen shows loading and Back before its session starts, and starts no timer", async () => {
    const timers = fakeTimers();
    const signIn = (await rigWith(STORED)).signIn;
    const out = renderToString(
      <OnlineGameFlow
        auth={setup().auth}
        signIn={signIn}
        playerId="user-1"
        matchId="m-1"
        play={play(timers)}
        onBack={() => {}}
      />,
    );
    expect(out).toContain('<p role="status">Loading the game</p>');
    expect(out).toMatch(/<button[^>]*min-width:44px[^>]*>Back<\/button>/);
    expect(out).not.toContain('class="game"');
    expect(timers.waiting()).toEqual([]);
  });
});

describe("Open in My games", () => {
  it("opens the pressed game's match id", async () => {
    const r = await startedRig([matchRow({ match_id: "m-3" })]);
    const opened: string[] = [];
    expect(r.lobby.getSnapshot().games.list?.map((g) => g.matchId)).toEqual(["m-3"]);
    const t = treeOf(
      <LobbyView
        snapshot={r.lobby.getSnapshot()}
        actions={r.lobby}
        onSignOut={() => {}}
        onBack={() => {}}
        onOpen={(id) => opened.push(id)}
      />,
    );
    button(t, "Open").press();
    expect(opened).toEqual(["m-3"]);
  });
});
