// The log drawer's rules (L9, #489), without a browser: when it shows, and how it closes. Escape and a tap outside
// are driven here on a stand-in document, as mapControl.test.ts drives the map with stand-in elements.
import { describe, expect, it } from "vitest";
import { dismissDrawer, drawerShown } from "./drawerControl.ts";

describe("drawerShown", () => {
  it("is closed until the player opens it", () => {
    expect(drawerShown(null, null)).toBe(false);
    expect(drawerShown(null, "d1")).toBe(false);
  });
  it("stays open while the decision it was opened for still waits (a refusal keeps the same id)", () => {
    expect(drawerShown({ forId: "d1" }, "d1")).toBe(true);
  });
  it("stays open while nothing waits, as for a spectator, on the other side's turn or at the game's end", () => {
    expect(drawerShown({ forId: null }, null)).toBe(true);
  });
  it("closes by itself when a new decision waits for the player, so the decision is not under it", () => {
    expect(drawerShown({ forId: null }, "d2")).toBe(false);
    expect(drawerShown({ forId: "d1" }, "d2")).toBe(false);
  });
  it("closes once the decision it was opened for is answered", () => {
    expect(drawerShown({ forId: "d1" }, null)).toBe(false);
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
  const inDrawer = {};
  const inTicker = {};
  const elsewhere = {};
  let closed = 0;
  let focused = 0;
  const ticker = { ...part(inTicker), focus: () => void focused++ };
  const dispose = dismissDrawer(doc as unknown as EventTarget, { drawer: part(inDrawer), ticker }, () => void closed++);
  return { doc, inDrawer, inTicker, elsewhere, dispose, closed: () => closed, focused: () => focused };
}

describe("dismissDrawer", () => {
  it("closes on Escape and puts the keyboard back on the ticker", () => {
    const s = setup();
    s.doc.fire("keydown", { key: "Escape", target: s.inDrawer });
    expect(s.closed()).toBe(1);
    expect(s.focused()).toBe(1);
  });
  it("ignores every other key", () => {
    const s = setup();
    for (const key of ["Enter", " ", "Tab", "ArrowDown"]) s.doc.fire("keydown", { key, target: s.inDrawer });
    expect(s.closed()).toBe(0);
  });
  it("closes on a tap outside the drawer and the ticker, leaving the keyboard where the tap put it", () => {
    const s = setup();
    s.doc.fire("pointerdown", { target: s.elsewhere });
    expect(s.closed()).toBe(1);
    expect(s.focused()).toBe(0);
  });
  it("stays open on a tap inside the drawer, and leaves a tap on the ticker to the ticker itself", () => {
    const s = setup();
    s.doc.fire("pointerdown", { target: s.inDrawer });
    s.doc.fire("pointerdown", { target: s.inTicker });
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
