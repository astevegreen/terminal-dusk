import type { EventKind } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { eventPresentation } from "./eventPresentation.ts";
import { byCodeUnit } from "./test/order.ts";

describe("eventPresentation", () => {
  it("has an entry for every event kind", () => {
    const kinds: EventKind[] = [
      "cardDrawn",
      "cardDrawnHidden",
      "cardsDiscarded",
      "contingencyDeckReshuffled",
      "contingencyDrawn",
      "drawPileReshuffled",
      "eraStarted",
      "escalationChanged",
      "escalationCrisis",
      "handRevealed",
      "handRevealedHidden",
      "influencePlaced",
      "intervened",
      "marker",
      "modifierEnded",
      "modifierStarted",
      "pointsSpent",
      "realigned",
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
  it("logs a shown hand with its cards for the side that saw it", () => {
    const line = eventPresentation.handRevealed.log({
      kind: "handRevealed",
      visibility: "lio",
      side: "sae",
      cards: ["s2", "n2"],
      publicForm: { kind: "handRevealedHidden", visibility: "public", side: "sae", cards: 2 },
    });
    expect(line).toBe("sae's hand was shown to you: s2, n2.");
  });
  it("logs a shown hand to everyone else with how many cards, never which", () => {
    const line = eventPresentation.handRevealedHidden.log({
      kind: "handRevealedHidden",
      visibility: "public",
      side: "sae",
      cards: 2,
    });
    expect(line).toBe("sae's hand of 2 cards was shown to the other side.");
  });
  it("logs a discard with its cards in hand order", () => {
    const line = eventPresentation.cardsDiscarded.log({
      kind: "cardsDiscarded",
      visibility: "public",
      side: "lio",
      cards: ["l2", "n1"],
    });
    expect(line).toBe("lio discarded l2, n1.");
  });
  it("logs a discard from an empty hand as no cards", () => {
    const line = eventPresentation.cardsDiscarded.log({
      kind: "cardsDiscarded",
      visibility: "public",
      side: "sae",
      cards: [],
    });
    expect(line).toBe("sae discarded no cards.");
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
  it("logs a placed influence with the side, the country and its cost of 1 point", () => {
    const line = eventPresentation.influencePlaced.log({
      kind: "influencePlaced",
      visibility: "public",
      side: "lio",
      country: "alpha",
      cost: 1,
    });
    expect(line).toBe("lio placed 1 influence in alpha for 1 point.");
  });
  it("logs a placed influence that cost 2 points in a rival-controlled country", () => {
    const line = eventPresentation.influencePlaced.log({
      kind: "influencePlaced",
      visibility: "public",
      side: "sae",
      country: "charlie",
      cost: 2,
    });
    expect(line).toBe("sae placed 1 influence in charlie for 2 points.");
  });
  it("logs a realignment with the side, the country, both totals and what the loser lost", () => {
    const line = eventPresentation.realigned.log({
      kind: "realigned",
      visibility: "public",
      side: "lio",
      country: "delta",
      totals: { lio: 6, sae: 4 },
      loser: "sae",
      removed: 2,
    });
    expect(line).toBe("lio realigned in delta: lio 6, sae 4. sae lost 2 influence.");
  });
  it("logs a tied realignment as changing nothing", () => {
    const line = eventPresentation.realigned.log({
      kind: "realigned",
      visibility: "public",
      side: "sae",
      country: "charlie",
      totals: { lio: 4, sae: 4 },
      loser: null,
      removed: 0,
    });
    expect(line).toBe("sae realigned in charlie: lio 4, sae 4. A tie: nothing changed.");
  });
  it("logs an intervention with its draw, points, stability, result and the influence it moved (R16b)", () => {
    const base = { kind: "intervened", visibility: "public", side: "lio", country: "echo", stability: 1 } as const;
    expect(eventPresentation.intervened.log({ ...base, points: 2, draw: 4, result: 4, removed: 3, added: 1 })).toBe(
      "lio intervened in echo: draw 4 + 2 points - 2 x stability 1 = 4; removed 3 rival influence, added 1 own.",
    );
    expect(eventPresentation.intervened.log({ ...base, points: 1, draw: 1, result: 0, removed: 0, added: 0 })).toBe(
      "lio intervened in echo: draw 1 + 1 point - 2 x stability 1 = 0; no change.",
    );
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
  it("logs a rising escalationChanged as a rise to its new value", () => {
    const line = eventPresentation.escalationChanged.log({
      kind: "escalationChanged",
      visibility: "public",
      from: 3,
      to: 4,
    });
    expect(line).toBe("Escalation rises to 4.");
  });
  it("logs a falling escalationChanged as a fall, not a rise", () => {
    const line = eventPresentation.escalationChanged.log({
      kind: "escalationChanged",
      visibility: "public",
      from: 2,
      to: 1,
    });
    expect(line).toBe("Escalation falls to 1.");
  });
  it("logs a crisis drop from 6 to 3 as a fall", () => {
    const line = eventPresentation.escalationChanged.log({
      kind: "escalationChanged",
      visibility: "public",
      from: 6,
      to: 3,
    });
    expect(line).toBe("Escalation falls to 3.");
  });
  it("logs an escalationCrisis with the side that caused it, the number it drew and the drop to 3", () => {
    const line = eventPresentation.escalationCrisis.log({
      kind: "escalationCrisis",
      visibility: "public",
      side: "sae",
      value: 5,
    });
    expect(line).toBe("Crisis: SAE draws 5; Escalation drops to 3.");
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
