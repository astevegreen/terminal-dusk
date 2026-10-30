// The game screen and the replay wear the theme of the era their frame shows (#481): the game's root carries it as
// data-theme, which the stylesheets in this folder read.
import type { Frame, ReplayFrame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { ReplayView } from "../../replay/ReplayScreen.tsx";
import type { ReplayRecording } from "../../replay/recording.ts";
import { cardAffiliation, cardName, cardQuestion } from "../../testMode/fixture.ts";
import { TestModeView } from "../../testMode/TestModeScreen.tsx";
import { createTestSession } from "../../testMode/session.ts";
import { createVsAiSession } from "../../vsAi/session.ts";
import { playOut } from "../../vsAi/test/scriptedHuman.ts";
import { standInAi } from "../../vsAi/test/standInAi.ts";
import { GameScreen } from "../GameScreen.tsx";

const themeOf = (html: string, root: string): string | undefined =>
  new RegExp(`<div class="${root}[^"]*" data-theme="([^"]+)"`).exec(html)?.[1];

const testFrame = (): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer("lio");
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame;
};
const inEra = (frame: Frame, era: string | undefined): Frame => {
  const pub = { ...frame.view.public };
  if (era === undefined) delete pub.era;
  else pub.era = era;
  return { ...frame, view: { ...frame.view, public: pub } };
};
const game = (frame: Frame, era: string | null): string | undefined =>
  themeOf(
    renderToString(
      <GameScreen
        frame={frame}
        log={[]}
        era={era}
        label={cardName}
        question={cardQuestion}
        affiliation={cardAffiliation}
      />,
    ),
    "game",
  );

describe("the game screen's era theme", () => {
  const frame = testFrame();
  it("is the green-screen terminal in Era 1", () => {
    expect(game(inEra(frame, "era-1"), null)).toBe("terminal");
  });
  it("is the news desk in Era 2", () => {
    expect(game(inEra(frame, "era-2"), "era-2")).toBe("newsDesk");
  });
  it("is the data dashboard in Era 3, and for the future cards", () => {
    expect(game(inEra(frame, "era-3"), "era-3")).toBe("dashboard");
    expect(game(inEra(frame, "future"), "future")).toBe("dashboard");
  });
  it("follows the era the frame shows", () => {
    expect(game(inEra(frame, "era-2"), null)).toBe("newsDesk");
  });
  it("follows the latest era that started when the frame has no map, and so no era of its own", () => {
    expect(game(inEra(frame, undefined), "era-3")).toBe("dashboard");
    expect(game(inEra(frame, undefined), null)).toBe("terminal");
  });
});

describe("test mode's era theme", () => {
  const session = createTestSession(() => 0);
  session.setViewer("lio");
  const snapshot = session.getSnapshot();
  const testMode = (frameEra: string | undefined, era: string | null): string | undefined =>
    themeOf(
      renderToString(
        <TestModeView snapshot={{ ...snapshot, frame: inEra(snapshot.frame!, frameEra), era }} session={session} />,
      ),
      "game",
    );
  it("shows the theme of the frame's era", () => {
    expect(testMode("era-1", null)).toBe("terminal");
    expect(testMode("era-2", "era-2")).toBe("newsDesk");
    expect(testMode("era-3", "era-3")).toBe("dashboard");
  });
  it("shows the theme of the latest era the session has seen when the frame has none", () => {
    expect(testMode(undefined, null)).toBe("terminal");
    expect(testMode(undefined, "era-2")).toBe("newsDesk");
  });
});

describe("the replay's era theme", () => {
  let recording: ReplayRecording;
  beforeAll(async () => {
    const standIn = standInAi();
    const session = createVsAiSession({
      human: "lio",
      gameSeed: "era-theme-replay",
      aiSeed: 7,
      clock: () => 1_700_000_000_000,
      makeAi: standIn.makeAi,
    });
    await playOut(session, standIn);
    const finished = session.replay();
    if (!finished) throw new Error("the fixture game did not leave a replay");
    recording = finished;
  });
  // The fixture game has no eras, so eraStarted events are added to copies of its frames: Era 2 at step 2, Era 3 at
  // step 4.
  const eraEvent = (era: string) => ({ kind: "eraStarted", visibility: "public", era, cardsAdded: 3 }) as const;
  const withEras = (): ReplayRecording => ({
    ...recording,
    frames: recording.frames.map((f: ReplayFrame, i) =>
      i === 2 || i === 4 ? { ...f, events: [...f.events, eraEvent(i === 2 ? "era-2" : "era-3")] } : f,
    ),
  });
  const replayTheme = (index: number): string | undefined =>
    themeOf(
      renderToString(
        <ReplayView
          recording={withEras()}
          label={cardName}
          question={cardQuestion}
          affiliation={cardAffiliation}
          onClose={() => {}}
          index={index}
          onGo={() => {}}
        />,
      ),
      "replay",
    );
  it("shows each step in the theme of the era it was played in", () => {
    expect(recording.frames.length).toBeGreaterThan(5);
    for (const i of [0, 1]) expect(replayTheme(i)).toBe("terminal");
    for (const i of [2, 3]) expect(replayTheme(i)).toBe("newsDesk");
    expect(replayTheme(4)).toBe("dashboard");
    expect(replayTheme(recording.frames.length - 1)).toBe("dashboard");
  });
});
