import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../App.tsx";
import { createVsAiSession } from "./session.ts";
import type { VsAiSession } from "./session.ts";
import { flush, playOut } from "./test/scriptedHuman.ts";
import { standInAi } from "./test/standInAi.ts";
import type { StandInOptions } from "./test/standInAi.ts";
import { SidePicker, VsAiScreen, VsAiView, openSession } from "./VsAiScreen.tsx";

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
});

describe("the game screen against the AI", () => {
  it("shows the human's frame with answer buttons and no New game button while the game runs", () => {
    const { session } = start({ hold: true });
    const out = view(session);
    expect(out).toContain("You play LIO");
    expect(out).toContain("lio: pick an opening card");
    expect(out).toContain("<button");
    expect(out).not.toContain("New game");
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
