// @vitest-environment happy-dom
// The wiring around the "Find a ranked game" screen (#682): the lobby button that opens it, the screen's own start and
// 15 s poll loop (with fake timers), the game that started, "Open the game" handing over to the online game, and
// "Play the AI while you wait" taking the app to the game against the AI. Each fails if that wiring is reverted.
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App.tsx";
import { settle, testScreen } from "../test/screen.ts";
import { fakeTimers } from "../transport/test/remoteGame.ts";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { memoryStore } from "../platform/storage.ts";
import { LobbyFlow } from "./OnlineScreen.tsx";
import type { OnlineSetup } from "./OnlineScreen.tsx";
import type { PlaySetup } from "./OnlineGameScreen.tsx";
import { RankedScreen, POLL_MS } from "./RankedScreen.tsx";
import type { RankedSession } from "./rankedSession.ts";
import type { SignIn, SignInSnapshot } from "./signIn.ts";
import { OTHER, PLAYER, TOKEN, createFakeLobby } from "./test/fakeLobby.ts";
import { matchRow } from "./test/lobbyRig.ts";
import { TICKET } from "./test/rankedRig.ts";

const { screen, render, button, press } = testScreen();

const seekRow = { id: TICKET, preset: "normal", side: null };
const newGame = matchRow({ match_id: "m-new", sae_player: PLAYER, lio_player: OTHER });

const SIGNED_IN: SignInSnapshot = { kind: "signedIn", userId: PLAYER, busy: false, refusal: null };
const stubSignIn = (): SignIn =>
  ({
    getSnapshot: () => SIGNED_IN,
    subscribe: () => () => {},
    start: () => Promise.resolve(),
    signOut: () => Promise.resolve(),
    accessToken: () => Promise.resolve(TOKEN),
  }) as unknown as SignIn;

function world() {
  const fake = createFakeLobby();
  const timers = fakeTimers();
  const online: OnlineSetup = { auth: fake.endpoint, store: memoryStore(), platform: "web", copy: () => {} };
  const play: PlaySetup = {
    clock: () => 0,
    timers,
    label: cardName,
    question: cardQuestion,
    affiliation: cardAffiliation,
  };
  return { fake, timers, online, play };
}

/** A session that is hand-driven: it records the calls the screen makes. */
function spySession(phase: "form" | "searching") {
  const snapshot = { preset: "normal", side: null, phase, busy: false, refusal: null, started: null } as const;
  const session = {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    start: vi.fn(() => Promise.resolve()),
    poll: vi.fn(() => Promise.resolve()),
    choosePreset: vi.fn(),
    chooseSide: vi.fn(),
    search: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve()),
    again: vi.fn(),
  };
  return session satisfies RankedSession;
}

const screenProps = { onOpen: () => {}, onPlayAi: () => {}, onFullGame: () => {}, onBack: () => {} };

describe("the ranked screen starts and polls", () => {
  it("reads a search left open as soon as it opens", async () => {
    const session = spySession("form");
    await render(<RankedScreen session={session} timers={fakeTimers()} {...screenProps} />);
    expect(session.start).toHaveBeenCalled();
  });

  it("sets no timer while the player is only choosing", async () => {
    const timers = fakeTimers();
    await render(<RankedScreen session={spySession("form")} timers={timers} {...screenProps} />);
    expect(timers.waiting()).toEqual([]);
  });

  it("polls every 15 seconds while searching, and asks again after each answer", async () => {
    const session = spySession("searching");
    const timers = fakeTimers();
    await render(<RankedScreen session={session} timers={timers} {...screenProps} />);
    expect(timers.waiting()).toEqual([POLL_MS]);
    expect(POLL_MS).toBe(15_000);
    await act(async () => void timers.fire());
    await settle();
    expect(session.poll).toHaveBeenCalledTimes(1);
    expect(timers.waiting()).toEqual([POLL_MS]);
    await act(async () => void timers.fire());
    await settle();
    expect(session.poll).toHaveBeenCalledTimes(2);
  });

  it("stops polling when the screen is closed", async () => {
    const session = spySession("searching");
    const timers = fakeTimers();
    await render(<RankedScreen session={session} timers={timers} {...screenProps} />);
    await render(<p>gone</p>);
    expect(timers.waiting()).toEqual([]);
    expect(timers.fire()).toBe(0);
    expect(session.poll).not.toHaveBeenCalled();
  });
});

describe("from the lobby to a ranked game", () => {
  async function openRanked(answers: Parameters<ReturnType<typeof createFakeLobby>["answerNext"]>[0][]) {
    const w = world();
    const onPlayAi = vi.fn();
    w.fake.answerNext({ status: 200, body: [] });
    await render(
      <LobbyFlow
        online={w.online}
        signIn={stubSignIn()}
        play={w.play}
        playerId={PLAYER}
        onBack={() => {}}
        onPlayAi={onPlayAi}
      />,
    );
    await settle();
    for (const answer of answers) w.fake.answerNext(answer);
    await press("Find a ranked game");
    return { ...w, onPlayAi };
  }
  const searching = [
    { status: 200, body: [] },
    { status: 200, body: [seekRow] },
  ] as const;

  it("opens the ranked screen from the lobby's Find a ranked game button", async () => {
    await openRanked([...searching]);
    expect(screen.querySelector("h1")!.textContent).toBe("Find a ranked game");
    expect(screen.textContent).toContain("Searching for an opponent");
  });

  it("takes Play the AI while you wait to the game against the AI", async () => {
    const w = await openRanked([...searching]);
    await press("Play the AI while you wait");
    expect(w.onPlayAi).toHaveBeenCalledOnce();
  });

  it("shows the started game when the ticket is gone, and Open the game hands over to the online game", async () => {
    const w = await openRanked([...searching]);
    w.fake.answerNext({ status: 200, body: [] });
    w.fake.answerNext({ status: 200, body: [newGame] });
    await act(async () => void w.timers.fire());
    await settle();
    expect(screen.textContent).toContain("Your ranked game has started");
    const before = w.fake.requests.length;
    await press("Open the game");
    expect(screen.textContent).not.toContain("Your ranked game has started");
    expect(w.fake.requests.slice(before).some((r) => r.url.includes("m-new"))).toBe(true);
  });

  it("goes back to the lobby from Back", async () => {
    await openRanked([...searching]);
    await press("Back");
    expect(button("Find a ranked game")).toBeDefined();
  });
});

describe("the app's Play the AI link", () => {
  it("opens the game against the AI from the ranked screen", async () => {
    const w = world();
    w.fake.answerNext({ status: 200, body: [] });
    await render(
      <App
        clock={() => 0}
        newSeed={() => "s"}
        newAiSeed={() => 1}
        online={w.online}
        signIn={stubSignIn()}
        timers={w.timers}
      />,
    );
    await press("Play online");
    w.fake.answerNext({ status: 200, body: [] });
    w.fake.answerNext({ status: 200, body: [seekRow] });
    await press("Find a ranked game");
    expect(screen.textContent).toContain("Searching for an opponent");
    await press("Play the AI while you wait");
    expect(screen.textContent).not.toContain("Searching for an opponent");
    expect(button("Play online")).toBeUndefined();
    expect(screen.textContent).not.toContain("Play online");
  });
});
