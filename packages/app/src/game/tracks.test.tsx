// The score track and Escalation on screen (A15, issue #448): drawn from the frame's public state, and only on a map
// that has scoring. The frames come from the test mode, whose map has made-up scoring (end 20).
import type { PublicState } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTestSession } from "../testMode/session.ts";
import { Tracks } from "./tracks.tsx";

const base = (): PublicState => {
  const session = createTestSession(() => 0);
  session.setViewer("lio");
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame.view.public;
};
const html = (change: Partial<PublicState>): string => renderToString(<Tracks pub={{ ...base(), ...change }} />);
const withoutScoring = (): PublicState => {
  const pub = base();
  const map = { ...pub.map! };
  delete map.scoring;
  return { ...pub, map };
};

describe("the score track", () => {
  it("has a scoring map to draw in the test mode", () => {
    expect(base().map?.scoring?.track.end).toBe(20);
  });
  it.each([
    [-20, "LIO 20", "0"],
    [0, "even", "50"],
    [20, "SAE 20", "100"],
    [-5, "LIO 5", "37.5"],
  ])("at %i reads %s with the marker at %s%%", (score, words, percent) => {
    const out = html({ score });
    expect(out).toContain('role="meter"');
    expect(out).toContain('aria-valuemin="-20"');
    expect(out).toContain('aria-valuemax="20"');
    expect(out).toContain(`aria-valuenow="${score}"`);
    expect(out).toContain(`aria-valuetext="${words}"`);
    expect(out).toContain(`left:${percent}%`);
  });
  it("names each side's end of the track", () => {
    const out = html({ score: 0 });
    expect(out).toContain("LIO wins at -20");
    expect(out).toContain("SAE wins at +20");
  });
});

describe("Escalation", () => {
  it.each([
    [2, "Escalation 2 of 6: Unstable Peace. Closed: none"],
    [3, "Escalation 3 of 6: Confrontation. Closed: Test Region C"],
    [5, "Escalation 5 of 6: Brink. Closed: Test Region C, Test Region F, Test Region A"],
  ])("at %i says its level, name and closed regions", (escalation, text) => {
    expect(html({ escalation })).toContain(text);
  });
});

describe("a map without scoring", () => {
  it("shows nothing", () => {
    expect(renderToString(<Tracks pub={withoutScoring()} />)).toBe("");
  });
});
