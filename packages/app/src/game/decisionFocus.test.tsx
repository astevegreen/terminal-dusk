import type { Decision } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { createTestSession } from "../testMode/session.ts";
import { FIRST_CHOICE, FocusingGameScreen, applyDecisionFocus, shouldFocusDecision } from "./decisionFocus.tsx";
import type { FocusRoot } from "./decisionFocus.tsx";
import { GameScreen } from "./GameScreen.tsx";
import type { GameScreenProps } from "./GameScreen.tsx";

const decision = (id: string): Decision => ({ id, side: "lio", kind: "yesNo", options: {} });

describe("the move-focus rule", () => {
  it("moves focus to the first decision on mount (previous id null)", () => {
    expect(shouldFocusDecision(null, decision("d1"), true)).toBe(true);
  });
  it("moves focus to a decision with a new id", () => {
    expect(shouldFocusDecision("d1", decision("d2"), true)).toBe(true);
  });
  it("keeps focus where it is for the same decision again (a refusal or a re-render)", () => {
    expect(shouldFocusDecision("d1", decision("d1"), true)).toBe(false);
  });
  it("does nothing when no decision is waiting", () => {
    expect(shouldFocusDecision("d1", null, true)).toBe(false);
    expect(shouldFocusDecision(null, null, true)).toBe(false);
  });
  it("never moves focus on a read-only screen", () => {
    expect(shouldFocusDecision(null, decision("d1"), false)).toBe(false);
    expect(shouldFocusDecision("d1", decision("d2"), false)).toBe(false);
  });
});

/** A stand-in page that records which selector was asked for and whether its button got focus. */
const fakeRoot = () => {
  const seen = { selectors: [] as string[], focused: 0 };
  const root: FocusRoot = {
    querySelector: (selector) => {
      seen.selectors.push(selector);
      return { focus: () => (seen.focused += 1) };
    },
  };
  return { root, seen };
};

describe("applying the rule", () => {
  it("focuses the decision's first button for a new decision and remembers its id", () => {
    const { root, seen } = fakeRoot();
    expect(applyDecisionFocus(null, decision("d1"), true, root)).toBe("d1");
    expect(seen).toEqual({ selectors: [FIRST_CHOICE], focused: 1 });
  });
  it("leaves focus on the pressed button after a refusal (same id)", () => {
    const { root, seen } = fakeRoot();
    expect(applyDecisionFocus("d1", decision("d1"), true, root)).toBe("d1");
    expect(seen.focused).toBe(0);
  });
  it("remembers null when no decision waits, so the next one gets focus", () => {
    const { root, seen } = fakeRoot();
    expect(applyDecisionFocus("d1", null, true, root)).toBeNull();
    expect(applyDecisionFocus(null, decision("d2"), true, root)).toBe("d2");
    expect(seen.focused).toBe(1);
  });
  it("does not focus on a read-only screen, and copes with no root yet", () => {
    const { root, seen } = fakeRoot();
    expect(applyDecisionFocus(null, decision("d1"), false, root)).toBe("d1");
    expect(seen.focused).toBe(0);
    expect(applyDecisionFocus(null, decision("d1"), true, null)).toBe("d1");
  });
});

const frameFor = (viewer: "lio" | "spectator"): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer(viewer);
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame;
};
const props = (frame: Frame): GameScreenProps => ({
  frame,
  log: ["first"],
  era: null,
  label: cardName,
  question: cardQuestion,
  affiliation: cardAffiliation,
  onAnswer: () => {},
});

describe("the focusing wrapper", () => {
  it("draws the same game screen inside a plain div, so nothing looks different", () => {
    const frame = frameFor("lio");
    expect(renderToString(<FocusingGameScreen {...props(frame)} />)).toBe(
      `<div>${renderToString(<GameScreen {...props(frame)} />)}</div>`,
    );
  });
});

describe("tab order", () => {
  const out = renderToString(<GameScreen {...props(frameFor("lio"))} />);
  it("has no positive tabIndex", () => {
    expect(out).not.toMatch(/tabindex="[1-9]/);
    expect(renderToString(<GameScreen {...props(frameFor("spectator"))} />)).not.toMatch(/tabindex="[1-9]/);
  });
  it("puts nothing focusable in the status bar", () => {
    const status = /data-testid="status-bar"[^>]*>(.*?)<\/section>/.exec(out)?.[1] ?? "";
    expect(status).not.toMatch(/<button|<a |<input|tabindex/);
  });
  it("follows reading order: the hand, the side column, the decision's choices, then the log list", () => {
    const at = (text: string): number => out.indexOf(text);
    // The decision's first choice: the first button after the Decision region opens (the map's region buttons,
    // issue #366, come before the hand, as the map does on screen).
    const choice = out.indexOf("<button", at('data-testid="decision"'));
    const marks = [
      at('data-testid="hand" class="game-hand" tabindex="0"'),
      at('aria-label="Game details" tabindex="0"'),
      at('data-testid="decision"'),
      choice,
      at('<ol aria-label="Log entries" tabindex="0">'),
    ];
    for (const mark of marks) expect(mark).toBeGreaterThan(-1);
    expect([...marks].sort((a, b) => a - b)).toEqual(marks);
  });
});
