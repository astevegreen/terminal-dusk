import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../App.tsx";
import { byCodeUnit } from "../test/order.ts";
import { createVsAiSession } from "./session.ts";
import type { VsAiSession } from "./session.ts";
import { flush, playOut } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";
import type { StandInOptions } from "./test/standInAi.ts";
import { SidePicker, VsAiScreen, VsAiView, openSession, vsAiOptions } from "./VsAiScreen.tsx";
import type { VsAiGame } from "./VsAiScreen.tsx";
import { cardAffiliation, cardQuestion, fixtureConfig, fixtureRuleset } from "../testMode/fixture.ts";
import { createLocalMatch } from "../transport/localMatch.ts";

const GAME_SEED = "screen-seed-never-shown-91c2";
const clock = (): number => 1_700_000_000_000;
const start = (options: StandInOptions = {}) => {
  const standIn = standInAi(options);
  const session = createVsAiSession({ human: "lio", gameSeed: GAME_SEED, aiSeed: 5, clock, makeAi: standIn.makeAi });
  return { session, standIn };
};
const view = (session: VsAiSession): string =>
  renderToString(<VsAiView snapshot={session.getSnapshot()} session={session} onNewGame={() => {}} />);

describe("the way in", () => {
  it("has a Play against the AI button on the home screen", () => {
    expect(renderToString(<App clock={clock} newSeed={() => "s"} newAiSeed={() => 1} />)).toContain(
      "Play against the AI</button>",
    );
  });
  it("opens on a side picker with two 44 px buttons and the practice line", () => {
    const out = renderToString(<VsAiScreen clock={clock} newSeed={() => GAME_SEED} newAiSeed={() => 1} />);
    expect(out).toBe(renderToString(<SidePicker onPick={() => {}} />));
    expect(out).toMatch(/min-width:44px[^>]*>Play as LIO<\/button>/);
    expect(out).toMatch(/min-width:44px[^>]*>Play as SAE<\/button>/);
    expect(out).toContain("Practice game with developer test cards");
  });
  it("says under each button who the side is (docs/design/sides.md, #414)", () => {
    const out = renderToString(<SidePicker onPick={() => {}} />);
    expect(out).toContain(
      "Play as LIO</button><p>LIO (Liberal International Order): The US-led bloc of real states.</p>",
    );
    expect(out).toContain(
      "Play as SAE</button><p>SAE (Strategic Authoritarian Entente): Russia and China as one unified side.</p>",
    );
  });
});

describe("the game screen against the AI", () => {
  it("shows the human's frame with answer buttons and no New game button while the game runs", () => {
    const { session } = start({ hold: true });
    const out = view(session);
    expect(out).toContain("You play LIO");
    expect(out).toContain("LIO: pick an opening card");
    expect(out).toContain("<button");
    expect(out).not.toContain("New game");
  });
  it("shows the rules text of each card in the hand when the game gives it, and names only when not (#414)", () => {
    const { session } = start({ hold: true });
    const snapshot = session.getSnapshot();
    const hand = snapshot.frame?.view.mine?.hand ?? [];
    expect(hand.length).toBeGreaterThan(0);
    const rules = (id: string): string => `Rules of ${id}.`;
    const out = renderToString(<VsAiView snapshot={snapshot} session={session} onNewGame={() => {}} rules={rules} />);
    for (const id of hand) expect(out).toContain(`<span class="hand-card-rules">Rules of ${id}.</span>`);
    expect(view(session)).not.toContain("hand-card-rules");
  });
  it("draws the game screen inside the wrapper that moves focus to each new decision", () => {
    const { session } = start({ hold: true });
    expect(view(session)).toContain('<div><div class="game game-no-map">');
  });
  it("shows Game over and a New game button at the end", async () => {
    const { session, standIn } = start();
    await playOut(session, standIn);
    const out = view(session);
    expect(out).toContain("Game over");
    expect(out).toContain("New game</button>");
  });
  it("shows a refused AI answer on its own line, apart from the human's refusal", async () => {
    const { session } = start({ override: () => ({ kind: "yesNo", yes: true }) });
    await flush();
    const code = session.getSnapshot().aiRefusal;
    expect(code).not.toBeNull();
    const out = view(session);
    expect(out).toContain(`AI refused: ${code}`);
    expect(out).not.toContain("Refused: ");
  });
  it("never renders the game seed", async () => {
    const { session, standIn } = start();
    const pages: string[] = [view(session)];
    session.subscribe(() => pages.push(view(session)));
    await playOut(session, standIn);
    for (const page of pages) expect(page).not.toContain(GAME_SEED);
  });
});

describe("leaving the screen", () => {
  it("stops the AI when the screen's clean-up runs", () => {
    const { session, standIn } = start({ hold: true });
    let shown: VsAiSession | null = null;
    const cleanUp = openSession(
      () => session,
      (s) => (shown = s),
    );
    expect(shown).toBe(session);
    expect(standIn.stops).toBe(0);
    cleanUp();
    expect(standIn.stops).toBe(1);
  });
});

describe("the session the screen starts", () => {
  const setup = { clock, newSeed: () => GAME_SEED, newAiSeed: () => 5, makeAi: standInAi().makeAi };
  it("names the log's cards with the chosen game's card names, so a real deck never shows test-card names", () => {
    const named = (id: string): string => `Named ${id}`;
    const game: VsAiGame = {
      ruleset: fixtureRuleset,
      makeMatch: (seed, now) => createLocalMatch(fixtureRuleset, fixtureConfig, seed, now),
      cardName: named,
      cardQuestion,
      cardAffiliation,
      note: "A named game",
    };
    const options = vsAiOptions("sae", { ...setup, game });
    expect(options.label).toBe(named);
    expect(options.ruleset).toBe(game.ruleset);
    expect(options.makeMatch).toBe(game.makeMatch);
    expect(options.human).toBe("sae");
  });
  it("with no game chosen, leaves the names to the session, which uses the developer fixture's", () => {
    const options = vsAiOptions("lio", setup);
    expect("label" in options).toBe(false);
    expect("ruleset" in options).toBe(false);
  });
});

describe("the replay after a game against the AI", () => {
  it("is not ready during the game, and the screen offers no Watch replay button", () => {
    const { session } = start({ hold: true });
    expect(session.getSnapshot().replayReady).toBe(false);
    expect(session.replay()).toBeNull();
    expect(view(session)).not.toContain("Watch replay");
  });
  it("is ready at the end: Watch replay shows, and the snapshot and the recording hold no seed", async () => {
    const { session, standIn } = start();
    await playOut(session, standIn);
    expect(session.getSnapshot().replayReady).toBe(true);
    expect(view(session)).toContain("Watch replay</button>");
    const recording = session.replay();
    expect(recording?.frames.length).toBeGreaterThan(2);
    expect(Object.keys(recording!).sort(byCodeUnit)).toEqual(["frames", "matchId", "seedHash", "status"]);
    expect(JSON.stringify(session.getSnapshot())).not.toContain(GAME_SEED);
    expect(JSON.stringify(recording)).not.toContain(GAME_SEED);
  });
  it("comes after the log in tab order, then New game, with no positive tabIndex", async () => {
    const { session, standIn } = start();
    await playOut(session, standIn);
    const out = view(session);
    const marks = ['<ol aria-label="Log entries"', "Watch replay</button>", "New game</button>"].map((t) =>
      out.indexOf(t),
    );
    for (const mark of marks) expect(mark).toBeGreaterThan(-1);
    expect([...marks].sort((a, b) => a - b)).toEqual(marks);
    expect(out).not.toMatch(/tabindex="[1-9]/);
  });
  it("stays not ready when the game is stopped part-way", () => {
    const { session } = start({ hold: true });
    session.stop();
    expect(session.replay()).toBeNull();
  });
});
