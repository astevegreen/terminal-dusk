// The Details panel's era line (#674): on a phone the top bar squeezes the era out (#490), so the panel names it too,
// with the same words and the same fallback as the status bar (#669).
import type { EraId } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { createTestSession } from "../testMode/session.ts";
import { GameScreen } from "./GameScreen.tsx";

/** A real frame with its era set to `frameEra`, or taken out. */
const frameIn = (viewer: "lio" | "spectator", frameEra: EraId | undefined): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer(viewer);
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  const pub = { ...frame.view.public };
  if (frameEra === undefined) delete pub.era;
  else pub.era = frameEra;
  return { ...frame, view: { ...frame.view, public: pub } };
};

/** The era line as the status bar and as the Details panel draw it, on one whole game screen. */
const eraLines = (frame: Frame, era: EraId | null): { bar: string | undefined; details: string | undefined } => {
  const out = renderToString(
    <GameScreen
      frame={frame}
      log={[]}
      era={era}
      label={cardName}
      question={cardQuestion}
      affiliation={cardAffiliation}
    />,
  );
  const status = /data-testid="status-bar"[^]*?<\/section>/.exec(out)?.[0] ?? "";
  const panel = /<div[^>]*class="game-drawer game-details"[^]*?(?=<section aria-label="Map")/.exec(out)?.[0] ?? "";
  return {
    // The status bar's fourth item: viewer, turn, plays, then the era.
    bar: [...status.matchAll(/<span>([^<]*)<\/span>/g)][3]?.[1],
    details: /data-testid="era"[^>]*><p>([^<]*)<\/p>/.exec(panel)?.[1],
  };
};

describe("the Details panel's era line (#674)", () => {
  it.each([
    ["the frame's era", "era-1", null, "The Thaw (Era 1, 1991–2001)"],
    ["the era of a seen eraStarted event, over the frame's", "era-1", "era-3", "The Fracture (Era 3, 2008–2025)"],
    ["a seen event's era when the frame has none", undefined, "era-2", "The Shock (Era 2, 2001–2008)"],
    ["an era id it has no text for, as it is", "late", null, "late"],
    ["the fallback when neither names one", undefined, null, "Era not shown yet"],
  ] as const)("says what the status bar says: %s", (_name, frameEra, seen, words) => {
    expect(eraLines(frameIn("lio", frameEra), seen)).toEqual({ bar: words, details: words });
  });

  it("names the era for a spectator too", () => {
    expect(eraLines(frameIn("spectator", "era-2"), null).details).toBe("The Shock (Era 2, 2001–2008)");
  });
});
