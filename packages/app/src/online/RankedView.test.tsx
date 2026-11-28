// The ranked screen drawn from each snapshot with renderToString and walked with treeOf.
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RankedView } from "./RankedView.tsx";
import type { RankedActions } from "./RankedView.tsx";
import type { RankedSnapshot } from "./rankedSession.ts";
import { STARTED_NOTIFICATION_PLACEHOLDER } from "./rankedText.ts";
import { button, treeOf } from "./test/screenTree.ts";

const FORM: RankedSnapshot = { preset: "normal", side: null, phase: "form", busy: false, refusal: null, started: null };

function setup(snapshot: RankedSnapshot) {
  const actions: RankedActions = {
    choosePreset: vi.fn(),
    chooseSide: vi.fn(),
    search: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve()),
    again: vi.fn(),
  };
  const calls = { open: vi.fn(), ai: vi.fn(), full: vi.fn(), back: vi.fn() };
  const view = (
    <RankedView
      snapshot={snapshot}
      actions={actions}
      onOpen={calls.open}
      onPlayAi={calls.ai}
      onFullGame={calls.full}
      onBack={calls.back}
    />
  );
  return { actions, calls, tree: treeOf(view), html: renderToString(view) };
}

describe("the ranked screen: the form", () => {
  it("offers the three presets by name and the three side choices, and Search", () => {
    const t = setup(FORM).tree;
    expect(t.buttons.filter((b) => b.pressed !== undefined).map((b) => b.text)).toEqual([
      "Fast",
      "Normal",
      "Slow",
      "No preference",
      "LIO",
      "SAE",
    ]);
    expect(button(t, "Search").disabled).toBe(false);
  });

  it("shows no hours: the presets are names only", () => {
    expect(setup(FORM).html).not.toMatch(/\bhours?\b|\bdays?\b/i);
  });

  it("marks the current preset and side as pressed", () => {
    const t = setup({ ...FORM, preset: "slow", side: "sae" }).tree;
    expect(t.buttons.filter((b) => b.pressed === true).map((b) => b.text)).toEqual(["Slow", "SAE"]);
  });

  it("passes the choices and Search to the session", () => {
    const s = setup(FORM);
    button(s.tree, "Fast").press();
    button(s.tree, "SAE").press();
    button(s.tree, "No preference").press();
    button(s.tree, "Search").press();
    expect(s.actions.choosePreset).toHaveBeenCalledWith("fast");
    expect(s.actions.chooseSide).toHaveBeenCalledWith("sae");
    expect(s.actions.chooseSide).toHaveBeenCalledWith(null);
    expect(s.actions.search).toHaveBeenCalled();
  });

  it("makes every button at least 44 px", () => {
    const s = setup({ ...FORM, refusal: "notEntitled" });
    for (const b of s.tree.buttons) {
      expect(s.html).toMatch(new RegExp(`<button[^>]*min-height:44px[^>]*min-width:44px[^>]*>${b.text}</button>`));
    }
  });

  it("tells a free player why and offers the Full Game with a working button", () => {
    const s = setup({ ...FORM, refusal: "notEntitled" });
    expect(s.html).toContain("Ranked games are for owners of the Full Game");
    button(s.tree, "Get the Full Game").press();
    expect(s.calls.full).toHaveBeenCalled();
  });

  it("shows the refusal at 5 games in words", () => {
    const html = setup({ ...FORM, refusal: "limitReached" }).html;
    expect(html).toContain("You already have 5 ranked games running");
    expect(html).not.toContain("limitReached");
  });
});

describe("the ranked screen: searching", () => {
  const SEARCHING: RankedSnapshot = { ...FORM, phase: "searching" };

  it("shows Searching, says the app can be closed, and offers Cancel", () => {
    const s = setup(SEARCHING);
    expect(s.html).toContain("Searching for an opponent");
    expect(s.html).toContain("You can close the app");
    button(s.tree, "Cancel search").press();
    expect(s.actions.cancel).toHaveBeenCalled();
  });

  it("has no form and no Search button while searching", () => {
    const t = setup(SEARCHING).tree;
    expect(t.buttons.map((b) => b.text)).not.toContain("Search");
  });

  it("offers one line, Play the AI while you wait, that goes to the AI game", () => {
    const s = setup(SEARCHING);
    button(s.tree, "Play the AI while you wait").press();
    expect(s.calls.ai).toHaveBeenCalled();
  });
});

describe("the ranked screen: a started game", () => {
  const STARTED: RankedSnapshot = {
    ...FORM,
    phase: "started",
    started: { matchId: "m-9", mySide: "sae", status: { kind: "active" }, updatedAt: 1 },
  };

  it("shows the game, the placeholder notification text and a way to open it", () => {
    const s = setup(STARTED);
    expect(s.html).toContain("You play SAE");
    expect(s.html).toContain(STARTED_NOTIFICATION_PLACEHOLDER);
    expect(STARTED_NOTIFICATION_PLACEHOLDER).toMatch(/^Placeholder/);
    button(s.tree, "Open the game").press();
    expect(s.calls.open).toHaveBeenCalledWith("m-9");
  });

  it("Search again and Back work", () => {
    const s = setup(STARTED);
    button(s.tree, "Search again").press();
    button(s.tree, "Back").press();
    expect(s.actions.again).toHaveBeenCalled();
    expect(s.calls.back).toHaveBeenCalled();
  });
});
