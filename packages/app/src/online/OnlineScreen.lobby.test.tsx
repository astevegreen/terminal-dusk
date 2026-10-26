// The wiring from sign-in to the lobby: once signed in the online screen draws the lobby for that player, built
// from the setup's endpoint, platform and copy function and the sign-in's access token.
import { isValidElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../platform/storage.ts";
import { createLobbySession } from "./lobbySession.ts";
import { LobbyFlow, SignInFlow, lobbyOptions, onlineStep } from "./OnlineScreen.tsx";
import type { OnlineSetup } from "./OnlineScreen.tsx";
import { SignInView } from "./SignInView.tsx";
import type { PlaySetup } from "./OnlineGameScreen.tsx";
import { cardName, cardQuestion } from "../testMode/fixture.ts";
import { fakeTimers } from "../transport/test/remoteGame.ts";
import type { SignInSnapshot } from "./signIn.ts";
import { LOBBY_URL, createFakeLobby } from "./test/fakeLobby.ts";
import { STORED, rig, rigWith } from "./test/signInRig.ts";

const idle = { busy: false, refusal: null } as const;
const PLAY: PlaySetup = { clock: () => 0, timers: fakeTimers(), label: cardName, question: cardQuestion };

function setup(copied: string[] = []): OnlineSetup & { fake: ReturnType<typeof createFakeLobby> } {
  const fake = createFakeLobby();
  return {
    fake,
    auth: fake.endpoint,
    store: memoryStore(),
    platform: "web",
    copy: (text) => void copied.push(text),
  };
}

const signedInRig = async () => {
  const r = await rigWith(STORED);
  await r.signIn.start();
  return r;
};

describe("onlineStep", () => {
  it("draws the lobby for the signed-in player, keyed by that player", async () => {
    const r = await signedInRig();
    const online = setup();
    const onBack = () => {};
    const snapshot: SignInSnapshot = { kind: "signedIn", userId: "user-7", ...idle };
    const step = onlineStep(snapshot, { online, signIn: r.signIn, play: PLAY, onBack });
    expect(isValidElement(step)).toBe(true);
    expect(step.type).toBe(LobbyFlow);
    expect(step.key).toBe("user-7");
    expect(step.props).toEqual({ online, signIn: r.signIn, play: PLAY, playerId: "user-7", onBack });
  });
  it("gives a different player a different key, so a fresh lobby", async () => {
    const r = await signedInRig();
    const props = { online: setup(), signIn: r.signIn, play: PLAY, onBack: () => {} };
    const keys = ["user-1", "user-2"].map((userId) => onlineStep({ kind: "signedIn", userId, ...idle }, props).key);
    expect(keys).toEqual(["user-1", "user-2"]);
  });
  it("draws the sign-in steps when not signed in", () => {
    const props = { online: setup(), signIn: rig().signIn, play: PLAY, onBack: () => {} };
    const states: SignInSnapshot[] = [
      { kind: "loading", ...idle },
      { kind: "email", ...idle },
      { kind: "code", email: "ana@example.com", ...idle },
    ];
    for (const snapshot of states) expect(onlineStep(snapshot, props).type).toBe(SignInView);
  });
});

describe("lobbyOptions", () => {
  it("passes the setup's endpoint, platform and copy function and the player's id", async () => {
    const r = await signedInRig();
    const online = setup();
    const options = lobbyOptions(online, r.signIn, "user-0");
    expect(options.endpoint).toBe(online.auth);
    expect(options.platform).toBe("web");
    expect(options.copy).toBe(online.copy);
    expect(options.playerId).toBe("user-0");
  });
  it("asks the sign-in session for the token on every call", async () => {
    const r = await signedInRig();
    const options = lobbyOptions(setup(), r.signIn, "user-0");
    expect(await options.accessToken()).toBe(STORED.accessToken);
    await r.signIn.signOut();
    expect(await options.accessToken()).toBeNull();
  });
  it("a lobby built from them creates the game on the setup's server, as web, with the sign-in token", async () => {
    const r = await signedInRig();
    const copied: string[] = [];
    const online = setup(copied);
    const lobby = createLobbySession(lobbyOptions(online, r.signIn, "user-0"));
    online.fake.answerNext({ status: 200, body: { ok: true, code: "ABC123" } });
    await lobby.create();
    const request = online.fake.requests[0];
    expect(request?.url).toBe(`${LOBBY_URL}/functions/v1/invite`);
    expect(request?.headers.Authorization).toBe(`Bearer ${STORED.accessToken}`);
    expect(request?.body).toMatchObject({ action: "create", platform: "web" });
    await lobby.copyCode();
    expect(copied).toEqual(["ABC123"]);
  });
});

describe("SignInFlow", () => {
  it("shows the lobby in place of the Signed in placeholder once signed in", async () => {
    const r = await signedInRig();
    const out = renderToString(<SignInFlow online={setup()} signIn={r.signIn} play={PLAY} onBack={() => {}} />);
    for (const heading of ["New game", "Join a game", "My games"]) expect(out).toContain(`>${heading}</h2>`);
    expect(out).toContain("Sign out");
    expect(out).not.toContain("<p>Signed in</p>");
  });
  it("shows the email step before signing in", async () => {
    const r = rig();
    await r.signIn.start();
    const out = renderToString(<SignInFlow online={setup()} signIn={r.signIn} play={PLAY} onBack={() => {}} />);
    expect(out).toContain('name="email"');
    expect(out).not.toContain("New game");
  });
});
