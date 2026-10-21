import type { EventKind } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { eventPresentation } from "./eventPresentation.ts";
import { byCodeUnit } from "./test/order.ts";

describe("eventPresentation", () => {
  it("has an entry for every event kind", () => {
    const kinds: EventKind[] = [
      "cardDrawn",
      "cardDrawnHidden",
      "contingencyDeckReshuffled",
      "contingencyDrawn",
      "drawPileReshuffled",
      "eraStarted",
      "marker",
      "modifierEnded",
      "modifierStarted",
      "pointsSpent",
      "triggerEnded",
      "triggerFired",
      "triggerSet",
    ];
    expect(Object.keys(eventPresentation).sort(byCodeUnit)).toEqual(kinds);
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
  it("logs a reshuffled draw pile with how many cards it got back, never which", () => {
    const line = eventPresentation.drawPileReshuffled.log({
      kind: "drawPileReshuffled",
      visibility: "public",
      cards: 12,
    });
    expect(line).toBe("The draw pile ran out: 12 discarded cards were shuffled into a new one.");
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
  it("logs a contingency draw with the deck it came from and the number drawn", () => {
    const line = eventPresentation.contingencyDrawn.log({
      kind: "contingencyDrawn",
      visibility: "public",
      deck: "lio",
      value: 4,
    });
    expect(line).toBe("A contingency was drawn from the lio Contingency deck: 4.");
  });
  it("logs a World deck draw as coming from the World deck", () => {
    const line = eventPresentation.contingencyDrawn.log({
      kind: "contingencyDrawn",
      visibility: "public",
      deck: "world",
      value: 2,
    });
    expect(line).toBe("A contingency was drawn from the World deck: 2.");
  });
  it("logs a reshuffle with the deck that was shuffled back together", () => {
    const line = eventPresentation.contingencyDeckReshuffled.log({
      kind: "contingencyDeckReshuffled",
      visibility: "public",
      deck: "sae",
    });
    expect(line).toBe("sae's Contingency deck was shuffled back together.");
  });
  it("logs a World deck reshuffle", () => {
    const line = eventPresentation.contingencyDeckReshuffled.log({
      kind: "contingencyDeckReshuffled",
      visibility: "public",
      deck: "world",
    });
    expect(line).toBe("The World deck was shuffled back together.");
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
  it("logs a new modifier with the card that made it, its change and how long it lasts", () => {
    const line = eventPresentation.modifierStarted.log({
      kind: "modifierStarted",
      visibility: "public",
      source: "c4",
      mod: { hook: "opsValue", side: "both", add: -1, min: 1 },
      expires: { kind: "turnEnd", turn: 2 },
    });
    expect(line).toBe("c4: ops values for both sides -1, minimum 1, until the end of the turn.");
  });
  it("logs a modifier's end with the card that made it and its change", () => {
    const line = eventPresentation.modifierEnded.log({
      kind: "modifierEnded",
      visibility: "public",
      source: "c4",
      mod: { hook: "opsValue", side: "sae", add: 2 },
    });
    expect(line).toBe("c4's change ended: ops values for sae +2.");
  });
  it("logs a modifier without a minimum with just its change", () => {
    const line = eventPresentation.modifierEnded.log({
      kind: "modifierEnded",
      visibility: "public",
      source: "c4",
      mod: { hook: "opsValue", side: "lio", add: -2 },
    });
    expect(line).toBe("c4's change ended: ops values for lio -2.");
  });
  it.each([
    ["triggerSet", "cardPlayed", "c4 set a reaction whenever a card is played this turn."],
    ["triggerSet", "turnEnd", "c4 set a reaction at the end of this turn."],
    ["triggerFired", "cardPlayed", "c4's reaction ran (whenever a card is played this turn)."],
    ["triggerFired", "turnEnd", "c4's reaction ran (at the end of this turn)."],
    ["triggerEnded", "cardPlayed", "c4's reaction ended (whenever a card is played this turn)."],
  ] as const)("logs %s for a %s trigger with the card that set it and its hook", (kind, hook, expected) => {
    expect(eventPresentation[kind].log({ kind, visibility: "public", source: "c4", hook } as never)).toBe(expected);
  });
});
