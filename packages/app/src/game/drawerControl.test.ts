// The rules of the top bar's two panels (L9, #489; L10, #490), without a browser: which one shows, when the log is
// pinned, and how an open one closes. Escape and a tap outside are driven here on a stand-in document, as
// mapControl.test.ts drives the map with stand-in elements.
import { describe, expect, it } from "vitest";
import { dismissable, dismissPanel, logShown, shownPanel } from "./drawerControl.ts";

describe("shownPanel", () => {
  it("is closed until the player opens one", () => {
    expect(shownPanel(null, null)).toBeNull();
    expect(shownPanel(null, "d1")).toBeNull();
  });
  it("stays open while the decision it was opened for still waits (a refusal keeps the same id)", () => {
    expect(shownPanel({ panel: "log", forId: "d1" }, "d1")).toBe("log");
    expect(shownPanel({ panel: "details", forId: "d1" }, "d1")).toBe("details");
  });
  it("stays open while nothing waits, as for a spectator, on the other side's turn or at the game's end", () => {
    expect(shownPanel({ panel: "log", forId: null }, null)).toBe("log");
    expect(shownPanel({ panel: "details", forId: null }, null)).toBe("details");
  });
  it("closes by itself when a new decision waits for the player, so the decision is not under it", () => {
    expect(shownPanel({ panel: "log", forId: null }, "d2")).toBeNull();
    expect(shownPanel({ panel: "log", forId: "d1" }, "d2")).toBeNull();
    expect(shownPanel({ panel: "details", forId: "d1" }, "d2")).toBeNull();
  });
  it("closes once the decision it was opened for is answered", () => {
    expect(shownPanel({ panel: "log", forId: "d1" }, null)).toBeNull();
    expect(shownPanel({ panel: "details", forId: "d1" }, null)).toBeNull();
  });
});

describe("logShown", () => {
  it("shows the log when it is the panel open, and not when Details is (one thing open at a time)", () => {
    expect(logShown("log", false, false)).toBe(true);
    expect(logShown("details", false, true)).toBe(false);
    expect(logShown(null, false, true)).toBe(false);
  });
  it("keeps a pinned log showing on a large screen, whatever else is open or waits", () => {
    expect(logShown(null, true, true)).toBe(true);
    expect(logShown("details", true, true)).toBe(true);
  });
  it("never keeps a pinned log over the map of a screen that is not large", () => {
    expect(logShown(null, true, false)).toBe(false);
  });
});

describe("dismissable", () => {
  it("is the open panel, which Escape and a tap outside close", () => {
    expect(dismissable("log", false)).toBe("log");
    expect(dismissable("details", false)).toBe("details");
    expect(dismissable(null, false)).toBeNull();
  });
  it("is never a pinned log, which stays until it is unpinned or closed; Details over it still closes", () => {
    expect(dismissable("log", true)).toBeNull();
    expect(dismissable("details", true)).toBe("details");
  });
});

type Listener = (event: { key?: string; target?: unknown }) => void;

/** Just enough of a document: listeners by type, and a way to fire an event at them. */
class FakeDocument {
  readonly listeners: { type: string; fn: Listener }[] = [];
  addEventListener(type: string, fn: Listener) {
    this.listeners.push({ type, fn });
  }
  removeEventListener(type: string, fn: Listener) {
    const at = this.listeners.findIndex((l) => l.type === type && l.fn === fn);
    if (at >= 0) this.listeners.splice(at, 1);
  }
  fire(type: string, event: { key?: string; target?: unknown }) {
    for (const l of this.listeners.filter((l) => l.type === type)) l.fn(event);
  }
}

/** A part of the page that holds the things listed. */
const part = (...inside: object[]) => ({ contains: (node: unknown) => inside.includes(node as object) });

function setup() {
  const doc = new FakeDocument();
  const inPanel = {};
  const inOpener = {};
  const elsewhere = {};
  let closed = 0;
  let focused = 0;
  const opener = { ...part(inOpener), focus: () => void focused++ };
  const dispose = dismissPanel(doc as unknown as EventTarget, { panel: part(inPanel), opener }, () => void closed++);
  return { doc, inPanel, inOpener, elsewhere, dispose, closed: () => closed, focused: () => focused };
}

describe("dismissPanel", () => {
  it("closes on Escape and puts the keyboard back on its opener (the ticker or Details)", () => {
    const s = setup();
    s.doc.fire("keydown", { key: "Escape", target: s.inPanel });
    expect(s.closed()).toBe(1);
    expect(s.focused()).toBe(1);
  });
  it("ignores every other key", () => {
    const s = setup();
    for (const key of ["Enter", " ", "Tab", "ArrowDown"]) s.doc.fire("keydown", { key, target: s.inPanel });
    expect(s.closed()).toBe(0);
  });
  it("closes on a tap outside the panel and its opener, leaving the keyboard where the tap put it", () => {
    const s = setup();
    s.doc.fire("pointerdown", { target: s.elsewhere });
    expect(s.closed()).toBe(1);
    expect(s.focused()).toBe(0);
  });
  it("stays open on a tap inside the panel, and leaves a tap on its opener to the opener itself", () => {
    const s = setup();
    s.doc.fire("pointerdown", { target: s.inPanel });
    s.doc.fire("pointerdown", { target: s.inOpener });
    expect(s.closed()).toBe(0);
  });
  it("removes both of its listeners when disposed", () => {
    const s = setup();
    expect(s.doc.listeners.map((l) => l.type).sort()).toEqual(["keydown", "pointerdown"]);
    s.dispose();
    expect(s.doc.listeners).toEqual([]);
    s.doc.fire("keydown", { key: "Escape" });
    s.doc.fire("pointerdown", { target: s.elsewhere });
    expect(s.closed()).toBe(0);
  });
});
