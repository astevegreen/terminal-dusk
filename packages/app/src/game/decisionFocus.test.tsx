import type { Decision } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { createTestSession } from "../testMode/session.ts";
import {
  FIRST_CHOICE,
  FocusingGameScreen,
  MAP_CHOICE,
  STRIP_CHIP,
  applyDecisionFocus,
  shouldFocusDecision,
} from "./decisionFocus.tsx";
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
  it("follows reading order: Details and the ticker, their panels, the map, the decision banner, the hand strip's chips", () => {
    const at = (text: string): number => out.indexOf(text);
    // Since L10 (#490) the Details button and the ticker end the top bar, and the two panels they open come right
    // after it, so the keyboard reaches an open panel next (opening one also moves the keyboard into it). Since L9
    // (#489) the log is in the drawer the ticker opens. The map's region buttons (issue #366) come next, as the map
    // does on screen; since L7 (#487) the decision banner sits between the map and the strip; since L6 (#486) the
    // hand is a strip along the bottom edge, its whole width since L10. The opening pick's choices are on the lifted
    // cards, so the decision's region has the question only.
    const marks = [
      at('class="game-details-button"'),
      at('data-testid="ticker"'),
      at('<ol aria-label="Log entries" tabindex="0">'),
      at('aria-label="Game details"'),
      at('<div class="game-details-body" role="group" aria-label="Details" tabindex="0">'),
      at('data-testid="map-area"'),
      at('data-testid="decision"'),
      at('data-testid="hand"'),
      at('class="strip-chip"'),
    ];
    for (const mark of marks) expect(mark).toBeGreaterThan(-1);
    expect([...marks].sort((a, b) => a - b)).toEqual(marks);
  });
  it("lets only one chip take Tab, so the arrow keys move along the strip (roving tabindex)", () => {
    const chips = [...out.matchAll(/class="strip-chip"[^>]*tabindex="(-?\d)"/g)].map((m) => m[1]);
    expect(chips.length).toBeGreaterThan(1);
    expect(chips.filter((t) => t === "0")).toHaveLength(1);
    expect(chips[0]).toBe("0");
  });
});

describe("focus for a decision whose choices are on the cards", () => {
  it("falls back to the hand strip's chip when the decision's region has no button", () => {
    const seen: string[] = [];
    let focused = "";
    const root: FocusRoot = {
      querySelector: (selector) => {
        seen.push(selector);
        return selector === STRIP_CHIP ? { focus: () => (focused = selector) } : null;
      },
    };
    applyDecisionFocus(null, decision("d1"), true, root);
    expect(seen).toEqual([FIRST_CHOICE, MAP_CHOICE, STRIP_CHIP]);
    expect(focused).toBe(STRIP_CHIP);
  });
});

describe("focus for a decision whose choices are countries (L7, #487)", () => {
  it("falls back to the first glowing country on the map, before the hand strip, when the banner has no button", () => {
    const seen: string[] = [];
    let focused = "";
    let options: FocusOptions | undefined;
    const root: FocusRoot = {
      querySelector: (selector) => {
        seen.push(selector);
        return selector === STRIP_CHIP || selector === MAP_CHOICE
          ? {
              focus: (given) => {
                focused = selector;
                options = given;
              },
            }
          : null;
      },
    };
    applyDecisionFocus(null, decision("d1"), true, root);
    expect(seen).toEqual([FIRST_CHOICE, MAP_CHOICE]);
    expect(focused).toBe(MAP_CHOICE);
    // Without scrolling: only the map's one CSS transform may move the map area (Decision 6).
    expect(options).toEqual({ preventScroll: true });
  });
  it("looks for the glowing countries' buttons in the drawn map and in the List", () => {
    expect(MAP_CHOICE).toContain(".dm-marker button");
    expect(MAP_CHOICE).toContain(".map-pick");
  });
});
