import type { EventKind } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { eventPresentation } from "./eventPresentation.ts";

describe("eventPresentation", () => {
  it("has an entry for every event kind", () => {
    const kinds: EventKind[] = ["cardDrawn", "cardDrawnHidden"];
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
});
