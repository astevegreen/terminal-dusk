// The sheet's tab (L1, issue #464): which one shows, and how it draws. The log has its own drawer since L9 (#489),
// and the decision is a banner above the hand strip since L7 (#487), so Details is the one tab left: the sheet starts
// folded, a new decision folds it again, and a tab the player picked holds only while the decision it was picked for
// waits.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonsOf } from "../testMode/promptTree.ts";
import { SideTabs, TABS, shownTab } from "./sideTabs.tsx";

describe("shownTab", () => {
  it("shows no tab (a folded sheet) when the player has picked nothing, so the map stays clear (L7, #487)", () => {
    expect(shownTab(null, null, null)).toBeNull();
    expect(shownTab(null, null, "d1")).toBeNull();
  });
  it("keeps the picked tab while the decision it was picked for still waits (a refusal keeps the same id)", () => {
    expect(shownTab("details", "d1", "d1")).toBe("details");
  });
  it("keeps the picked tab while nothing waits, as for a spectator or on the other side's turn", () => {
    expect(shownTab("details", null, null)).toBe("details");
  });
  it("folds the sheet by itself when a new decision arrives, so the countries to pick are not under it", () => {
    expect(shownTab("details", null, "d2")).toBeNull();
    expect(shownTab("details", "d1", "d2")).toBeNull();
  });
  it("folds the sheet once the decision it was picked for has gone", () => {
    expect(shownTab("details", "d1", null)).toBeNull();
  });
  it("shows no tab while the player has folded the sheet with Hide, for the same decision (L5, #485)", () => {
    expect(shownTab("hide", "d1", "d1")).toBeNull();
    expect(shownTab("hide", null, null)).toBeNull();
  });
  it("stays folded when a new decision arrives while the sheet is folded", () => {
    expect(shownTab("hide", "d1", "d2")).toBeNull();
    expect(shownTab("hide", null, "d1")).toBeNull();
  });
});

describe("SideTabs", () => {
  const out = renderToString(
    <SideTabs waitingId="d1">
      <p>details panel</p>
    </SideTabs>,
  );
  it("has the one tab Details: the log has its drawer (L9, #489) and the decision its banner (L7, #487)", () => {
    expect(TABS.map((tab) => tab.title)).toEqual(["Details"]);
    const titles = [...out.matchAll(/role="tab"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
    expect(titles).toEqual(["Details"]);
  });
  it("starts folded: no tab is selected and the panel is hidden, but it is in the page", () => {
    expect(out).not.toContain('aria-selected="true"');
    const panels = [...out.matchAll(/<div role="tabpanel"([^>]*)>(.*?)<\/div>/g)];
    expect(panels.map((m) => m[2])).toEqual(["<p>details panel</p>"]);
    expect(panels.map((m) => (m[1] ?? "").includes("hidden"))).toEqual([true]);
  });
  it("ties the tab to its panel by id, and lets the keyboard reach the panel, with no positive tabIndex", () => {
    for (const [, controls] of out.matchAll(/aria-controls="([^"]+)"/g)) expect(out).toContain(`id="${controls}"`);
    expect(out.match(/role="tabpanel"[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(out).not.toMatch(/tabindex="[1-9]/);
  });
  it("puts a Hide button beside the tab, outside the tablist, in a bar of its own, gone while folded (L5, #485)", () => {
    expect(out).toMatch(
      /^<div class="game-sheet-bar"><div role="tablist"[^>]*>.*?<\/div><button type="button"[^>]*hidden=""[^>]*>Hide<\/button><\/div>/,
    );
    expect(out.match(/role="tab"/g)).toHaveLength(1);
  });
  it("is a memo element, so the test walkers step over its hook and still reach the panel's buttons", () => {
    const pressed: string[] = [];
    const buttons = buttonsOf(
      <SideTabs waitingId={null}>
        <button type="button" onClick={() => pressed.push("details")}>
          Open
        </button>
      </SideTabs>,
    );
    expect(buttons.map((b) => b.text)).toEqual(["Open"]);
    buttons[0]?.click();
    expect(pressed).toEqual(["details"]);
  });
});
