import type { EventKind } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { eventPresentation } from "./eventPresentation.ts";

describe("eventPresentation", () => {
  it("has an entry for every event kind", () => {
    const kinds: EventKind[] = [
      "cardDrawn",
      "cardDrawnHidden",
      "contingencyDeckReshuffled",
      "contingencyDrawn",
      "eraStarted",
      "marker",
      "pointsSpent",
    ];
    expect(Object.keys(eventPresentation).sort()).toEqual(kinds);
  });
  it("logs a drawn card for the side that drew it", () => {
    const line = eventPresentation.cardDrawn.log({
      kind: "cardDrawn",
      visibility: "lio",
      side: "lio",
      card: "c7",
      publicForm: { kind: "cardDrawnHidden", visibility: "public", side: "lio" },
    });
    expect(line).toBe("lio drew c7.");
  });
  it("logs a hidden draw without any card", () => {
    const line = eventPresentation.cardDrawnHidden.log({ kind: "cardDrawnHidden", visibility: "public", side: "sae" });
    expect(line).toBe("sae drew a card.");
  });
  it("logs a marker with its label, and its value when it has one", () => {
    expect(eventPresentation.marker.log({ kind: "marker", visibility: "public", label: "item", value: "a" })).toBe(
      "Marker item: a.",
    );
    expect(eventPresentation.marker.log({ kind: "marker", visibility: "public", label: "done" })).toBe("Marker done.");
  });
  it("logs spent points with the side that played the card and the amount", () => {
    const line = eventPresentation.pointsSpent.log({
      kind: "pointsSpent",
      visibility: "public",
      side: "sae",
      amount: 3,
    });
    expect(line).toBe("sae spent 3 points.");
  });
  it("logs a new era with its name and the number of cards added, never which cards", () => {
    const line = eventPresentation.eraStarted.log({
      kind: "eraStarted",
      visibility: "public",
      era: "era2",
      cardsAdded: 4,
    });
    expect(line).toBe("Era era2 started: 4 cards shuffled into the draw pile.");
  });
  it("logs a contingency draw with the side and the number drawn", () => {
    const line = eventPresentation.contingencyDrawn.log({
      kind: "contingencyDrawn",
      visibility: "public",
      side: "lio",
      value: 4,
    });
    expect(line).toBe("lio drew a contingency: 4.");
  });
  it("logs a reshuffle with the side whose deck was shuffled back together", () => {
    const line = eventPresentation.contingencyDeckReshuffled.log({
      kind: "contingencyDeckReshuffled",
      visibility: "public",
      side: "sae",
    });
    expect(line).toBe("sae's Contingency deck was shuffled back together.");
  });
  it("logs a marker holding a drawn number as that number", () => {
    expect(eventPresentation.marker.log({ kind: "marker", visibility: "public", label: "drew", value: 5 })).toBe(
      "Marker drew: 5.",
    );
  });
  it("logs a marker holding both sides' answers as each side's yes or no, in SIDES order", () => {
    const value = { sae: false, lio: true };
    expect(eventPresentation.marker.log({ kind: "marker", visibility: "public", label: "pick", value })).toBe(
      "Marker pick: lio yes, sae no.",
    );
  });
});
