// The side panel's three tabs (L1, issue #464): which one shows, and how they draw. The Play tab opens by itself
// whenever a new decision waits; a tab the player picked holds only while the decision it was picked for waits.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonsOf } from "../testMode/promptTree.ts";
import { SideTabs, TABS, shownTab } from "./sideTabs.tsx";

describe("shownTab", () => {
  it("shows Play when the player has picked nothing", () => {
    expect(shownTab(null, null, null)).toBe("play");
    expect(shownTab(null, null, "d1")).toBe("play");
  });
  it("keeps the picked tab while the decision it was picked for still waits (a refusal keeps the same id)", () => {
    expect(shownTab("log", "d1", "d1")).toBe("log");
    expect(shownTab("details", "d1", "d1")).toBe("details");
  });
  it("keeps the picked tab while nothing waits, as for a spectator or on the other side's turn", () => {
    expect(shownTab("log", null, null)).toBe("log");
  });
  it("opens Play by itself when a new decision arrives", () => {
    expect(shownTab("log", null, "d2")).toBe("play");
    expect(shownTab("details", "d1", "d2")).toBe("play");
  });
  it("goes back to Play once the decision it was picked for has gone", () => {
    expect(shownTab("log", "d1", null)).toBe("play");
  });
});

describe("SideTabs", () => {
  const out = renderToString(
    <SideTabs waitingId="d1">
      <p>play panel</p>
      <p>log panel</p>
      <p>details panel</p>
    </SideTabs>,
  );
  it("names the three tabs Play, Log and Details, in that order", () => {
    expect(TABS.map((tab) => tab.title)).toEqual(["Play", "Log", "Details"]);
    const titles = [...out.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
    expect(titles).toEqual(["Play", "Log", "Details"]);
  });
  it("opens on Play: only its panel shows, and only its tab is selected", () => {
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-selected="true"[^>]*>Play</);
    const panels = [...out.matchAll(/<div role="tabpanel"([^>]*)>(.*?)<\/div>/g)];
    expect(panels.map((m) => m[2])).toEqual(["<p>play panel</p>", "<p>log panel</p>", "<p>details panel</p>"]);
    expect(panels.map((m) => (m[1] ?? "").includes("hidden"))).toEqual([false, true, true]);
  });
  it("ties each tab to its panel by id, and lets the keyboard reach each panel, with no positive tabIndex", () => {
    for (const [, controls] of out.matchAll(/aria-controls="([^"]+)"/g)) expect(out).toContain(`id="${controls}"`);
    expect(out.match(/role="tabpanel"[^>]*tabindex="0"/g)).toHaveLength(3);
    expect(out).not.toMatch(/tabindex="[1-9]/);
  });
  it("is a memo element, so the test walkers step over its hook and still reach the panels' buttons", () => {
    const pressed: string[] = [];
    const buttons = buttonsOf(
      <SideTabs waitingId={null}>
        <button type="button" onClick={() => pressed.push("play")}>
          Answer
        </button>
        <p>log</p>
        <p>details</p>
      </SideTabs>,
    );
    expect(buttons.map((b) => b.text)).toEqual(["Answer"]);
    buttons[0]?.click();
    expect(pressed).toEqual(["play"]);
  });
});
