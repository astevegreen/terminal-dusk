// @vitest-environment happy-dom
// What follows the tutorial game's end (#667): Watch replay and back, New game starting the lesson again at chapter 1,
// and the full edition's end view. The whole screen is mounted in a stand-in page (happy-dom), so its buttons are
// really pressed and React does the rest. The game is answered through the screen's own session, and the AI is the
// stand-in, which needs no Web Worker.
import { TUTORIAL_LESSONS } from "@terminal-dusk/host";
import type { TutorialEdition } from "@terminal-dusk/host";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { standInAi } from "../vsAi/test/standInAi.ts";
import type { StandIn } from "../vsAi/test/standInAi.ts";
import { OFFER_TEXT } from "./FullGameOffer.tsx";
import { playUntil, pub } from "./test/playTutorial.ts";
import type { TutorialSession } from "./tutorialSession.ts";
import { COACHING_OVER, TutorialScreen } from "./TutorialScreen.tsx";

/** Every session the screen has made, in order. The sessions are the real ones. */
const made = vi.hoisted((): TutorialSession[] => []);
vi.mock("./tutorialSession.ts", async () => {
  const actual = await vi.importActual<typeof import("./tutorialSession.ts")>("./tutorialSession.ts");
  return {
    createTutorialSession: (...args: Parameters<typeof actual.createTutorialSession>) => {
      const session = actual.createTutorialSession(...args);
      made.push(session);
      return session;
    },
  };
});

const lesson = TUTORIAL_LESSONS[0]!;
const chapterOne = lesson.chapters[0]!;
const firstWords = chapterOne.steps[0]!.say;
/** The lesson's last chapter, which a free game shows at its end, Era 1's scoring (owner, #701: "Show it at game end"). */
const lastChapter = lesson.chapters.at(-1)!;
/** A whole game takes seconds, and several times as long on a loaded machine. */
const GAME_LIMIT = 60_000;

/** Every way the page could reach the network; each call is recorded and none gets through. */
const network = vi.fn();
let screen: HTMLElement;
let root: Root;
let ai: StandIn;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"])
    vi.stubGlobal(name, function reach(...args: unknown[]) {
      network(name, ...args);
      throw new Error(`no network in this test: ${name}`);
    });
  vi.spyOn(navigator, "sendBeacon").mockImplementation((url) => {
    network("sendBeacon", url);
    return false;
  });
  network.mockClear();
  made.length = 0;
  ai = standInAi();
  screen = document.body.appendChild(document.createElement("div"));
  root = createRoot(screen);
});

afterEach(async () => {
  await act(async () => root.unmount());
  screen.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const buttons = (name: string, within: Element = screen): HTMLButtonElement[] =>
  [...within.querySelectorAll("button")].filter((button) => button.textContent === name);

/** Presses the one button of that name, which must be able to be pressed. */
async function press(name: string, within?: Element): Promise<void> {
  const found = buttons(name, within);
  expect(found, `buttons named "${name}"`).toHaveLength(1);
  expect(found[0]!.disabled).toBe(false);
  await act(async () => found[0]!.click());
}

async function play(started: TutorialSession, done: (s: TutorialSession) => boolean): Promise<void> {
  await act(() => playUntil(started, done));
}

/** Opens the screen and plays its game to the end. */
async function finishedGame(edition: TutorialEdition): Promise<TutorialSession> {
  await act(async () =>
    root.render(
      <TutorialScreen
        clock={() => 1_700_000_000_000}
        newSeed={() => "tutorial-end-seed"}
        newAiSeed={() => 5}
        makeAi={ai.makeAi}
        lesson={lesson}
        edition={edition}
      />,
    ),
  );
  expect(made).toHaveLength(1);
  const started = made[0]!;
  await play(started, (s) => pub(s).status.kind === "over");
  return started;
}

const coachText = (): string => screen.querySelector(".tutorial-coach")?.textContent ?? "";
const replayControls = () => screen.querySelector('nav[aria-label="Replay controls"]');

/** The end view: the result, both end buttons and no replay. */
function expectEndView(): void {
  expect(screen.textContent).toContain("Game over: ");
  expect(buttons("Watch replay")).toHaveLength(1);
  expect(buttons("New game")).toHaveLength(1);
  expect(replayControls()).toBeNull();
}

describe("after the tutorial's game ends", () => {
  it(
    "Watch replay shows the replay and its controls, and closing it returns to the end view",
    async () => {
      await finishedGame("free");
      expectEndView();

      await press("Watch replay");
      expect(replayControls()?.textContent).toMatch(/Step 1 of \d+/);
      // The replayed game screen has its own "Close" buttons, so these are looked for among the replay's controls.
      for (const name of ["First", "Back", "Next", "Last", "Close"])
        expect(buttons(name, replayControls()!), `replay control "${name}"`).toHaveLength(1);
      expect(buttons("Watch replay")).toHaveLength(0);
      expect(buttons("New game")).toHaveLength(0);
      expect(screen.textContent).not.toContain(OFFER_TEXT);
      await press("Next", replayControls()!);
      expect(replayControls()?.textContent).toMatch(/Step 2 of \d+/);

      await press("Close", replayControls()!);
      expectEndView();
      expect(screen.textContent).toContain(OFFER_TEXT);
      // The same finished game, not a new one.
      expect(made).toHaveLength(1);
      expect(network).not.toHaveBeenCalled();
    },
    GAME_LIMIT,
  );

  it(
    "New game starts a new session, coached again from chapter 1",
    async () => {
      const first = await finishedGame("free");
      expect(lesson.id, "the screen's lesson is the real one").toBe("first-game");
      expect(coachText()).toContain(lastChapter.title);
      // The free game is over, so its last line drops "From here it's a normal game." (owner, 28 Nov 2026, in chat).
      expect(coachText()).toMatch(/That's the coaching\.$/);
      expect(coachText()).not.toContain("normal game");
      expect(coachText()).not.toContain(COACHING_OVER);
      expect(coachText()).not.toContain(firstWords);
      const stopped = ai.stops;

      await press("New game");
      expect(made).toHaveLength(2);
      const second = made[1]!;
      expect(second.session).not.toBe(first.session);
      expect(ai.stops).toBe(stopped + 1);
      expect(screen.textContent).not.toContain("Game over: ");

      await play(second, (s) => s.match!.coaching().text !== null);
      expect(coachText()).toContain(chapterOne.title);
      expect(coachText()).toContain(firstWords);
      expect(coachText()).not.toContain(COACHING_OVER);
      expect(network).not.toHaveBeenCalled();
    },
    GAME_LIMIT,
  );

  it(
    "the full edition's end view shows the result, Watch replay and New game, and no Full Game offer",
    async () => {
      const started = await finishedGame("full");
      // Past Era 1, where the free game ends.
      expect(pub(started).turn).toBeGreaterThan(3);
      expectEndView();
      expect(screen.textContent).not.toContain(OFFER_TEXT);
      expect(screen.querySelector(".full-game-offer")).toBeNull();
      expect(network).not.toHaveBeenCalled();
    },
    GAME_LIMIT,
  );
});
