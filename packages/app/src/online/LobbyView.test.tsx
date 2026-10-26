// The lobby screen drawn from each lobby snapshot with renderToString.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LobbyRefusal } from "./lobbyHttp.ts";
import type { LobbySession } from "./lobbySession.ts";
import { JOIN_HINT, LobbyView } from "./LobbyView.tsx";
import { LOBBY_REFUSAL } from "./lobbyText.ts";
import { OTHER, PLAYER, TOKEN, refusalBody } from "./test/fakeLobby.ts";
import { lobbyRig, matchRow, startedRig } from "./test/lobbyRig.ts";
import type { LobbyRig } from "./test/lobbyRig.ts";
import { button, treeOf } from "./test/screenTree.ts";

const page = (lobby: LobbySession): string =>
  renderToString(<LobbyView snapshot={lobby.getSnapshot()} actions={lobby} onSignOut={() => {}} onBack={() => {}} />);
const tree = (lobby: LobbySession) =>
  treeOf(<LobbyView snapshot={lobby.getSnapshot()} actions={lobby} onSignOut={() => {}} onBack={() => {}} />);
const tapSized = (out: string, text: string): void =>
  expect(out).toMatch(new RegExp(`<button[^>]*min-width:44px[^>]*>${text}</button>`));
const created = async (): Promise<LobbyRig> => {
  const r = await startedRig();
  r.fake.answerNext({ status: 200, body: { ok: true, code: "ABC123" } });
  await r.lobby.create();
  return r;
};

describe("the three parts", () => {
  it("shows New game, Join a game and My games, plus Sign out and Back, every button 44 px", async () => {
    const r = await created();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
    await r.lobby.join("xyz");
    const out = page(r.lobby);
    for (const heading of ["New game", "Join a game", "My games"]) expect(out).toContain(`>${heading}</h2>`);
    const t = tree(r.lobby);
    expect(t.buttons.length).toBeGreaterThan(15);
    for (const b of t.buttons) tapSized(out, b.text);
    expect(out).toMatch(/<input[^>]*min-height:44px;min-width:44px[^>]*name="code"/);
  });
});

describe("the create choices", () => {
  it("offers four side choices, three lengths and two rules, and no AI rule", () => {
    const t = tree(lobbyRig().lobby);
    const choices = t.buttons.filter((b) => b.pressed !== undefined).map((b) => b.text);
    expect(choices).toEqual([
      "Random sides",
      "I play LIO",
      "I play SAE",
      "My friend picks",
      "1 day",
      "3 days",
      "7 days",
      "Loss on time",
      "One extra deadline, then loss on time",
    ]);
    expect(page(lobbyRig().lobby)).not.toMatch(/\bAI\b/);
  });
  it("starts on random sides, 3 days and one extra deadline", () => {
    const pressed = tree(lobbyRig().lobby)
      .buttons.filter((b) => b.pressed === true)
      .map((b) => b.text);
    expect(pressed).toEqual(["Random sides", "3 days", "One extra deadline, then loss on time"]);
  });
  it("shows a picked choice as pressed", () => {
    const r = lobbyRig();
    r.lobby.chooseSides({ mode: "host", hostSide: "sae" });
    r.lobby.chooseDays(7);
    r.lobby.chooseRule("lossOnTime");
    const pressed = tree(r.lobby)
      .buttons.filter((b) => b.pressed === true)
      .map((b) => b.text);
    expect(pressed).toEqual(["I play SAE", "7 days", "Loss on time"]);
  });
  it("disables the choices and Create while a game is being created", async () => {
    const r = await startedRig();
    const creating = r.lobby.create();
    const t = tree(r.lobby);
    for (const text of ["Create game", "Random sides", "1 day", "Loss on time"])
      expect(button(t, text).disabled).toBe(true);
    await creating;
  });
});

describe("the shown code", () => {
  it("shows the invite code large with a Copy button and the line about Join a game", async () => {
    const r = await created();
    const out = page(r.lobby);
    expect(out).toContain('<p style="font-size:2em;font-weight:bold">ABC123</p>');
    tapSized(out, "Copy");
    expect(out).toContain(JOIN_HINT.replaceAll('"', "&quot;"));
  });
  it("shows no code or Copy before a create", () => {
    const t = tree(lobbyRig().lobby);
    expect(t.buttons.some((b) => b.text === "Copy")).toBe(false);
  });
});

describe("each refusal", () => {
  const cases: [LobbyRefusal, (r: LobbyRig) => Promise<void>][] = [
    ["notEntitled", (r) => (r.fake.answerNext({ status: 403, body: refusalBody("notEntitled") }), r.lobby.create())],
    [
      "invalidInvite",
      (r) => (r.fake.answerNext({ status: 400, body: refusalBody("invalidInvite") }), r.lobby.create()),
    ],
    [
      "inviteNotFound",
      (r) => (r.fake.answerNext({ status: 404, body: refusalBody("inviteNotFound") }), r.lobby.join("x")),
    ],
    [
      "sideNotChoosable",
      (r) => (r.fake.answerNext({ status: 400, body: refusalBody("sideNotChoosable") }), r.lobby.join("x")),
    ],
    ["sideRequired", (r) => (r.fake.answerNext({ status: 400, body: refusalBody("sideRequired") }), r.lobby.join("x"))],
    ["illegalSide", (r) => (r.fake.answerNext({ status: 400, body: refusalBody("illegalSide") }), r.lobby.join("x"))],
    [
      "ownInvite",
      async (r) => {
        r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
        await r.lobby.join("x");
        r.fake.answerNext({ status: 409, body: refusalBody("ownInvite") });
        await r.lobby.pickSide("lio");
      },
    ],
    ["notSignedIn", (r) => (r.fake.answerNext({ status: 401, body: {} }), r.lobby.create())],
    ["tooManyRequests", (r) => (r.fake.answerNext({ status: 429, body: {} }), r.lobby.join("x"))],
    ["network", (r) => (r.fake.answerNext("throw"), r.lobby.refresh())],
  ];
  for (const [refusal, reach] of cases) {
    it(`shows its own plain message for ${refusal}, announced to screen readers`, async () => {
      const r = await startedRig();
      await reach(r);
      const out = page(r.lobby);
      expect(out).toContain(`<p role="alert">${LOBBY_REFUSAL[refusal]}</p>`);
      expect(out).not.toContain("Server says");
    });
  }
  it("covers every refusal code with a different message", () => {
    expect(cases.map(([code]) => code).sort()).toEqual(Object.keys(LOBBY_REFUSAL).sort());
    expect(new Set(Object.values(LOBBY_REFUSAL)).size).toBe(cases.length);
  });
  it("notEntitled says free players can join but not create, and the code field stays usable", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 403, body: refusalBody("notEntitled") });
    await r.lobby.create();
    expect(page(r.lobby)).toContain("Free players can join a game they are invited to but cannot create one.");
    const t = tree(r.lobby);
    expect(t.inputs.find((i) => i.name === "code")?.disabled).toBe(false);
    expect(button(t, "Join").disabled).toBe(false);
  });
});

describe("the side question on join", () => {
  it("asks LIO or SAE when the invite lets the joiner pick", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
    await r.lobby.join("abc123");
    const out = page(r.lobby);
    expect(out).toContain("This invite lets you pick your side. LIO or SAE?");
    for (const text of ["Play LIO", "Play SAE"]) tapSized(out, text);
  });
  it("does not ask before a preview", () => {
    expect(page(lobbyRig().lobby)).not.toContain("Play LIO");
  });
  it("says which side the player has after joining", async () => {
    const r = await startedRig();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "random" } } });
    r.fake.answerNext({ status: 200, body: { ok: true, matchId: "m-9", side: "sae" } });
    r.fake.answerNext({ status: 200, body: [] });
    await r.lobby.join("abc123");
    expect(page(r.lobby)).toContain('<p role="status">You joined. You play SAE.</p>');
  });
});

describe("My games", () => {
  it("says it is loading before the first read", () => {
    expect(page(lobbyRig().lobby)).toContain("Loading your games");
  });
  it("says No games yet when the list is empty", async () => {
    expect(page((await startedRig()).lobby)).toContain("<p>No games yet</p>");
  });
  it("lists each game with my side and its state, newest first, win, loss and draw for me", async () => {
    const r = await startedRig([
      matchRow({ match_id: "a", updated_at: 1, status: { kind: "over", winner: null, reason: "x" } }),
      matchRow({ match_id: "b", updated_at: 4 }),
      matchRow({ match_id: "c", updated_at: 3, status: { kind: "over", winner: "lio", reason: "x" } }),
      matchRow({
        match_id: "d",
        updated_at: 2,
        lio_player: OTHER,
        sae_player: PLAYER,
        status: { kind: "over", winner: "lio", reason: "x" },
      }),
    ]);
    const items = [...page(r.lobby).matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
    expect(items).toEqual([
      "You play LIO. Your game is on",
      "You play LIO. Game over: you won",
      "You play SAE. Game over: you lost",
      "You play LIO. Game over: a draw",
    ]);
  });
  it("shows a failed read's message in My games and keeps the invite code", async () => {
    const r = await created();
    r.fake.answerNext("throw");
    await r.lobby.refresh();
    const out = page(r.lobby);
    const games = out.slice(out.indexOf(">My games</h2>"));
    expect(games).toContain(LOBBY_REFUSAL.network);
    expect(out.slice(0, out.indexOf(">My games</h2>"))).not.toContain(LOBBY_REFUSAL.network);
    expect(out).toContain("ABC123");
  });
});

describe("secrets", () => {
  it("no rendered page contains the token", async () => {
    const r = await startedRig([matchRow()]);
    const pages = [page(r.lobby)];
    r.lobby.subscribe(() => pages.push(page(r.lobby)));
    r.fake.answerNext({ status: 200, body: { ok: true, code: "ABC123" } });
    await r.lobby.create();
    r.fake.answerNext({ status: 200, body: { ok: true, sides: { mode: "invitee" } } });
    await r.lobby.join("abc123");
    r.fake.answerNext({ status: 409, body: refusalBody("ownInvite") });
    await r.lobby.pickSide("sae");
    expect(pages.length).toBeGreaterThan(5);
    for (const out of pages) expect(out).not.toContain(TOKEN);
  });
});
