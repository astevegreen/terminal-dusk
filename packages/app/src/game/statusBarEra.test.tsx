// The status bar's era line (#669): the era of the latest eraStarted event the caller has seen, else the era the
// frame shows, which a game with a map has from turn 1.
import type { EraId } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTestSession } from "../testMode/session.ts";
import { StatusBar } from "./regions.tsx";

/** A real frame with its era set to `frameEra`, or taken out. */
const frameIn = (frameEra: EraId | undefined): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer("lio");
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  const pub = { ...frame.view.public };
  if (frameEra === undefined) delete pub.era;
  else pub.era = frameEra;
  return { ...frame, view: { ...frame.view, public: pub } };
};
const bar = (frameEra: EraId | undefined, era: EraId | null): string =>
  renderToString(<StatusBar frame={frameIn(frameEra)} era={era} />);

describe("the status bar's era (#669)", () => {
  it("names the frame's era when no eraStarted event has been seen", () => {
    const out = bar("era-1", null);
    expect(out).toContain("<span>The Thaw (Era 1, 1991–2001)</span>");
    expect(out).not.toContain("Era not shown yet");
  });

  it("lets the era of a seen eraStarted event win over the frame's", () => {
    const out = bar("era-3", "future");
    expect(out).toContain("<span>Future cards (2025–2027)</span>");
    expect(out).not.toContain("The Fracture");
  });

  it("names the era of a seen eraStarted event when the frame has none", () => {
    expect(bar(undefined, "era-2")).toContain("<span>The Shock (Era 2, 2001–2008)</span>");
  });

  it("says the era is not shown yet when the frame has none and no event was seen", () => {
    expect(bar(undefined, null)).toContain("<span>Era not shown yet</span>");
  });
});
