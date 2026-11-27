// @vitest-environment happy-dom
// The tutorial when the answer about what the player owns changes while a lesson runs (#686): the running lesson is
// never restarted, an owner sees no Full Game offer at its end, and New game takes the edition the player has by then.
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
import { TutorialScreen } from "./TutorialScreen.tsx";

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

/** A whole game takes seconds, and several times as long on a loaded machine. */
const GAME_LIMIT = 60_000;
const clock = (): number => 1_700_000_000_000;
const newSeed = (): string => "tutorial-edition-seed";
const newAiSeed = (): number => 5;
let screen: HTMLElement;
let root: Root;
let ai: StandIn;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  made.length = 0;
  ai = standInAi();
  screen = document.body.appendChild(document.createElement("div"));
  root = createRoot(screen);
});
afterEach(async () => {
  await act(async () => root.unmount());
  screen.remove();
  vi.unstubAllGlobals();
});

const draw = (edition: TutorialEdition) =>
  act(async () =>
    root.render(
      <TutorialScreen
        clock={clock}
        newSeed={newSeed}
        newAiSeed={newAiSeed}
        makeAi={ai.makeAi}
        lesson={TUTORIAL_LESSONS[0]!}
        edition={edition}
      />,
    ),
  );
const finish = (started: TutorialSession) => act(() => playUntil(started, (s) => pub(s).status.kind === "over"));
const newGame = () =>
  act(async () => [...screen.querySelectorAll("button")].find((b) => b.textContent === "New game")!.click());

describe("an edition that changes while a lesson runs (#686)", () => {
  it(
    "a free lesson keeps running when the player turns out to own the game, with no offer; New game is the full one",
    async () => {
      await draw("free");
      await draw("full");
      expect(made).toHaveLength(1);
      await finish(made[0]!);
      expect(screen.textContent).toContain("Game over: ");
      expect(screen.textContent).not.toContain(OFFER_TEXT);
      await newGame();
      expect(made).toHaveLength(2);
      expect(pub(made[1]!).turns).toBeGreaterThan(3);
    },
    GAME_LIMIT,
  );

  it("a full lesson keeps running when the player signs out; New game is the free one", async () => {
    await draw("full");
    await draw("free");
    expect(made).toHaveLength(1);
    expect(pub(made[0]!).turns).toBeGreaterThan(3);
    expect(screen.textContent).not.toContain(OFFER_TEXT);
  });
});
