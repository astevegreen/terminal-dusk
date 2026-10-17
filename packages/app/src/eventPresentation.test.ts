import type { EventKind } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { eventPresentation } from "./eventPresentation.ts";

describe("eventPresentation", () => {
  it("has an entry for every event kind", () => {
    const kinds: EventKind[] = ["cardDrawn", "cardDrawnHidden", "marker"];
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
  it("logs a marker holding both sides' answers as each side's yes or no, in SIDES order", () => {
    const value = { sae: false, lio: true };
    expect(eventPresentation.marker.log({ kind: "marker", visibility: "public", label: "pick", value })).toBe(
      "Marker pick: lio yes, sae no.",
    );
  });
});
