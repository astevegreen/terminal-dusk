import { describe, expect, it } from "vitest";
import { announceOpen, onOtherOpen } from "./openOne.ts";

describe("one thing open at a time, by any means (#503)", () => {
  it("closes an open panel when a card is lifted, and a lifted card when a panel opens", () => {
    const doc = new EventTarget();
    let panelClosed = 0;
    let cardDropped = 0;
    const stopPanel = onOtherOpen(doc, "panel", () => void panelClosed++);
    const stopCard = onOtherOpen(doc, "card", () => void cardDropped++);
    announceOpen(doc, "card");
    expect([panelClosed, cardDropped]).toEqual([1, 0]);
    announceOpen(doc, "panel");
    expect([panelClosed, cardDropped]).toEqual([1, 1]);
    stopPanel();
    stopCard();
  });
  it("leaves the kind that opened alone: switching between the two panels is the top bar's own business", () => {
    const doc = new EventTarget();
    let closed = 0;
    const stop = onOtherOpen(doc, "panel", () => void closed++);
    announceOpen(doc, "panel");
    expect(closed).toBe(0);
    stop();
  });
  it("hears nothing once stopped, and ignores other events of the same name", () => {
    const doc = new EventTarget();
    let closed = 0;
    const stop = onOtherOpen(doc, "card", () => void closed++);
    doc.dispatchEvent(new Event("td:open"));
    expect(closed).toBe(0);
    stop();
    announceOpen(doc, "panel");
    expect(closed).toBe(0);
  });
});
