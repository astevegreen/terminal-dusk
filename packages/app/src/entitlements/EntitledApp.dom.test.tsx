// @vitest-environment happy-dom
// The App fed from real entitlements (#686): mounted whole in a stand-in page (happy-dom), signed in or out against a
// fake Supabase. No request for a signed-out player, a failed check said in words, a sign-in followed by a read, and
// a running game that an answer arriving late never restarts.
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appGames } from "../appGames.ts";
import { playerGames } from "../App.tsx";
import { SESSION_KEY } from "../online/signIn.ts";
import type { OnlineSetup } from "../online/OnlineScreen.tsx";
import { STORED } from "../online/test/signInRig.ts";
import { memoryStore } from "../platform/storage.ts";
import type { VsAiSession } from "../vsAi/session.ts";
import { playOut } from "../vsAi/test/scriptedHuman.ts";
import { standInAi } from "../vsAi/test/standInAi.ts";
import { OFFER_TEXT } from "../tutorial/FullGameOffer.tsx";
import { VsAiScreen } from "../vsAi/VsAiScreen.tsx";
import type { VsAiGame } from "../vsAi/VsAiScreen.tsx";
import { EntitledApp } from "./EntitledApp.tsx";
import { CHECKING, CHECK_FAILED, RETRY } from "./EntitlementNotice.tsx";
import { WEB_ROW, fakeEntitlements } from "./test/fakeEntitlements.ts";

/** Every vs-AI session the screens have made, in order. The sessions are the real ones. */
const made = vi.hoisted((): VsAiSession[] => []);
vi.mock("../vsAi/session.ts", async () => {
  const actual = await vi.importActual<typeof import("../vsAi/session.ts")>("../vsAi/session.ts");
  return {
    createVsAiSession: (...args: Parameters<typeof actual.createVsAiSession>) => {
      const session = actual.createVsAiSession(...args);
      made.push(session);
      return session;
    },
  };
});

const NOW = STORED.expiresAt - 3_600_000;
// One function each for the whole file, as in the real app: only the game a screen is handed changes between renders.
const clock = (): number => NOW;
const newSeed = (): string => "s";
const newAiSeed = (): number => 1;
let screen: HTMLElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  made.length = 0;
  screen = document.body.appendChild(document.createElement("div"));
  root = createRoot(screen);
});
afterEach(async () => {
  await act(async () => root.unmount());
  screen.remove();
  vi.unstubAllGlobals();
});

const settle = (): Promise<void> => act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
const button = (name: string): HTMLButtonElement | undefined =>
  [...screen.querySelectorAll("button")].find((b) => b.textContent === name);
async function press(name: string): Promise<void> {
  const found = button(name);
  expect(found, `a button named "${name}"`).toBeDefined();
  await act(async () => found!.click());
  await settle();
}

async function mount(signedIn: boolean, fake = fakeEntitlements({ [STORED.refreshToken]: STORED.userId })) {
  const store = memoryStore();
  if (signedIn) await store.set(SESSION_KEY, JSON.stringify(STORED));
  const online: OnlineSetup = {
    auth: { url: "https://fake.supabase.test", anonKey: "fake-anon-key", fetch: fake.fetch },
    store,
    platform: "web",
    copy: () => {},
  };
  await act(async () =>
    root.render(<EntitledApp clock={clock} newSeed={newSeed} newAiSeed={newAiSeed} {...appGames} online={online} />),
  );
  await settle();
  return fake;
}

const FREE_NOTE = "only, 3 turns";

describe("the app with real entitlements (#686)", () => {
  it("makes no network request for a signed-out player, who is free", async () => {
    const fake = await mount(false);
    expect(screen.textContent).not.toContain(CHECKING);
    await press("Play against the AI");
    expect(screen.textContent).toContain(FREE_NOTE);
    expect(fake.requests).toEqual([]);
  });

  it("with no online setup, the player is free", async () => {
    await act(async () =>
      root.render(<EntitledApp clock={clock} newSeed={newSeed} newAiSeed={newAiSeed} {...appGames} />),
    );
    await press("Play the six-region map");
    expect(screen.textContent).toContain(FREE_NOTE);
  });

  it("an owner on this platform gets each game in full", async () => {
    const fake = fakeEntitlements();
    fake.answerNext({ status: 200, body: [WEB_ROW] });
    await mount(true, fake);
    await press("Play against the AI");
    expect(screen.textContent).toContain(appGames.game.note);
    expect(screen.textContent).not.toContain(FREE_NOTE);
  });

  it("an entitlement for another platform leaves a web player free", async () => {
    const fake = fakeEntitlements();
    fake.answerNext({ status: 200, body: [{ platform: "steam", source: "steam" }] });
    await mount(true, fake);
    await press("Play against the AI");
    expect(screen.textContent).toContain(FREE_NOTE);
  });

  it("says it is checking while the rows load", async () => {
    const fake = fakeEntitlements();
    fake.hold();
    await mount(true, fake);
    expect(screen.textContent).toContain(CHECKING);
  });

  it("shows a failed check in words, on the home screen and the side picker, and Try again reads again", async () => {
    const fake = fakeEntitlements();
    fake.answerNext("throw");
    await mount(true, fake);
    expect(screen.textContent).toContain(CHECK_FAILED);
    await press("Play against the AI");
    expect(screen.textContent).toContain(CHECK_FAILED);
    fake.answerNext({ status: 200, body: [WEB_ROW] });
    await press(RETRY);
    expect(screen.textContent).not.toContain(CHECK_FAILED);
    expect(screen.textContent).toContain(appGames.game.note);
  });

  it("reads the rows after a sign-in on the online screen, so the next game is the owner's", async () => {
    const fake = await mount(false);
    await press("Play online");
    const type = async (value: string): Promise<void> => {
      const input = screen.querySelector("input")!;
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      await act(async () => {
        set.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        input.form!.requestSubmit();
      });
      await settle();
    };
    await type("ana@example.com");
    fake.answerNext({ status: 200, body: [WEB_ROW] });
    await type("123456");
    expect(fake.reads()).toHaveLength(1);
    await press("Back");
    await press("Play against the AI");
    expect(screen.textContent).toContain(appGames.game.note);
  });
});

describe("an answer that arrives while a game runs (#686)", () => {
  const picker = async (game: VsAiGame, ai = standInAi()) => {
    await act(async () =>
      root.render(<VsAiScreen clock={clock} newSeed={newSeed} newAiSeed={newAiSeed} makeAi={ai.makeAi} game={game} />),
    );
    return ai;
  };
  const free = playerGames(appGames, false).vsAi!;
  const full = playerGames(appGames, true).vsAi!;

  it("never restarts it, and a player now known to own the game sees no offer at its end", async () => {
    const ai = await picker(free);
    await press("Play as LIO");
    expect(made).toHaveLength(1);
    await picker(full, ai);
    expect(made).toHaveLength(1);
    await act(() => playOut(made[0]!, ai));
    expect(screen.textContent).toContain("Game over: ");
    expect(screen.textContent).not.toContain(OFFER_TEXT);
    // New game then starts the game this player now has.
    await press("New game");
    expect(screen.textContent).toContain(full.note);
  }, 60_000);

  it("a full game keeps running, with no offer, when the player stops being an owner (sign-out)", async () => {
    const ai = await picker(full);
    await press("Play as LIO");
    await picker(free, ai);
    expect(made).toHaveLength(1);
    expect(made[0]!.getSnapshot().frame!.view.public.turns).toBeGreaterThan(3);
    expect(screen.textContent).not.toContain(OFFER_TEXT);
  });
});
