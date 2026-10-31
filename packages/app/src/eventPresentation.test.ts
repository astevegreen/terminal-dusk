import type { EventKind, GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import type { GameNames } from "./displayText.ts";
import { eventPresentation, logLine } from "./eventPresentation.ts";
import { byCodeUnit } from "./test/order.ts";
import { testCountryName } from "./test/promptProps.ts";

/**
 * Test names: a card reads "Card C7"; only era2 has a name, as the status bar would show it; a country reads as its
 * id with a capital letter, so a line that printed the id would be caught (L7, #487).
 */
const NAMES: GameNames = {
  card: (id) => `Card ${id.toUpperCase()}`,
  era: (era) => (era === "era2" ? "Era 2 (2001–2008)" : era),
  region: (id) => (id === "europe" ? "Europe" : id),
  country: testCountryName,
};
const say = (event: GameEvent): string => logLine(event, NAMES);

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
      "regionScored",
      "scoreChanged",
      "techRaceAttempted",
      "triggerEnded",
      "triggerFired",
      "triggerSet",
    ];
    expect(Object.keys(eventPresentation).sort(byCodeUnit)).toEqual(kinds);
  });
  it("logs a tech race attempt's draw, bonus and move, or that the marker stayed", () => {
    const attempt = { kind: "techRaceAttempted", visibility: "public", side: "lio", points: 4, cost: 1 } as const;
    expect(say({ ...attempt, draw: 3, bonus: 1, from: 0, to: -1, first: true })).toBe(
      "LIO's tech race attempt draws 3 +1: the marker moves from 0 to -1.",
    );
    expect(say({ ...attempt, draw: 2, bonus: 0, from: 0, to: 0, first: false })).toBe(
      "LIO's tech race attempt draws 2: no move.",
    );
  });
  it("logs a drawn card by its name for the side that drew it", () => {
    const line = say({
      kind: "cardDrawn",
      visibility: "lio",
      side: "lio",
      card: "c7",
      publicForm: { kind: "cardDrawnHidden", visibility: "public", side: "lio" },
    });
    expect(line).toBe("LIO drew Card C7.");
  });
  it("logs a hidden draw without any card", () => {
    const line = say({ kind: "cardDrawnHidden", visibility: "public", side: "sae" });
    expect(line).toBe("SAE drew a card.");
  });
  it("logs a shown hand with its cards for the side that saw it", () => {
    const line = say({
      kind: "handRevealed",
      visibility: "lio",
      side: "sae",
      cards: ["s2", "n2"],
      publicForm: { kind: "handRevealedHidden", visibility: "public", side: "sae", cards: 2 },
    });
    expect(line).toBe("SAE's hand was shown to you: Card S2, Card N2.");
  });
  it("logs a shown hand to everyone else with how many cards, never which", () => {
    const line = say({
      kind: "handRevealedHidden",
      visibility: "public",
      side: "sae",
      cards: 2,
    });
    expect(line).toBe("SAE's hand of 2 cards was shown to the other side.");
  });
  it("logs a discard with its cards in hand order", () => {
    const line = say({
      kind: "cardsDiscarded",
      visibility: "public",
      side: "lio",
      cards: ["l2", "n1"],
    });
    expect(line).toBe("LIO discarded Card L2, Card N1.");
  });
  it("logs a discard from an empty hand as no cards", () => {
    const line = say({
      kind: "cardsDiscarded",
      visibility: "public",
      side: "sae",
      cards: [],
    });
    expect(line).toBe("SAE discarded no cards.");
  });
  it("logs a marker with its label, and its value when it has one", () => {
    expect(say({ kind: "marker", visibility: "public", label: "item", value: "a" })).toBe("Marker item: a.");
    expect(say({ kind: "marker", visibility: "public", label: "done" })).toBe("Marker done.");
  });
  it("logs spent points with the side that played the card and the amount", () => {
    const line = say({
      kind: "pointsSpent",
      visibility: "public",
      side: "sae",
      amount: 3,
    });
    expect(line).toBe("SAE spent 3 points.");
  });
  it("logs a placed influence with the side, the country and its cost of 1 point", () => {
    const line = say({
      kind: "influencePlaced",
      visibility: "public",
      side: "lio",
      country: "alpha",
      cost: 1,
    });
    expect(line).toBe("LIO placed 1 influence in Alpha for 1 point.");
  });
  it("logs a placed influence that cost 2 points in a rival-controlled country", () => {
    const line = say({
      kind: "influencePlaced",
      visibility: "public",
      side: "sae",
      country: "charlie",
      cost: 2,
    });
    expect(line).toBe("SAE placed 1 influence in Charlie for 2 points.");
  });
  it("logs a realignment with the side, the country, both totals and what the loser lost", () => {
    const line = say({
      kind: "realigned",
      visibility: "public",
      side: "lio",
      country: "delta",
      totals: { lio: 6, sae: 4 },
      loser: "sae",
      removed: 2,
    });
    expect(line).toBe("LIO realigned in Delta: LIO 6, SAE 4. SAE lost 2 influence.");
  });
  it("logs a tied realignment as changing nothing", () => {
    const line = say({
      kind: "realigned",
      visibility: "public",
      side: "sae",
      country: "charlie",
      totals: { lio: 4, sae: 4 },
      loser: null,
      removed: 0,
    });
    expect(line).toBe("SAE realigned in Charlie: LIO 4, SAE 4. A tie: nothing changed.");
  });
  it("logs an intervention with its draw, points, stability, result and the influence it moved (R16b)", () => {
    const base = { kind: "intervened", visibility: "public", side: "lio", country: "echo", stability: 1 } as const;
    expect(say({ ...base, points: 2, draw: 4, result: 4, removed: 3, added: 1 })).toBe(
      "LIO intervened in Echo: draw 4 + 2 points - 2 x stability 1 = 4; removed 3 rival influence, added 1 own.",
    );
    expect(say({ ...base, points: 1, draw: 1, result: 0, removed: 0, added: 0 })).toBe(
      "LIO intervened in Echo: draw 1 + 1 point - 2 x stability 1 = 0; no change.",
    );
  });
  it("logs a reshuffled draw pile with how many cards it got back, never which", () => {
    const line = say({
      kind: "drawPileReshuffled",
      visibility: "public",
      cards: 12,
    });
    expect(line).toBe("The draw pile ran out: 12 discarded cards were shuffled into a new one.");
  });
  it("logs a new era with its shown name and the number of cards added, never which cards", () => {
    const line = say({
      kind: "eraStarted",
      visibility: "public",
      era: "era2",
      cardsAdded: 4,
    });
    expect(line).toBe("Era 2 (2001–2008) started: 4 cards shuffled into the draw pile.");
  });
  it("logs a contingency draw with the deck it came from and the number drawn", () => {
    const line = say({
      kind: "contingencyDrawn",
      visibility: "public",
      deck: "lio",
      value: 4,
    });
    expect(line).toBe("A contingency was drawn from the LIO Contingency deck: 4.");
  });
  it("logs a World deck draw as coming from the World deck", () => {
    const line = say({
      kind: "contingencyDrawn",
      visibility: "public",
      deck: "world",
      value: 2,
    });
    expect(line).toBe("A contingency was drawn from the World deck: 2.");
  });
  it("logs a reshuffle with the deck that was shuffled back together", () => {
    const line = say({
      kind: "contingencyDeckReshuffled",
      visibility: "public",
      deck: "sae",
    });
    expect(line).toBe("SAE's Contingency deck was shuffled back together.");
  });
  it("logs a World deck reshuffle", () => {
    const line = say({
      kind: "contingencyDeckReshuffled",
      visibility: "public",
      deck: "world",
    });
    expect(line).toBe("The World deck was shuffled back together.");
  });
  it("logs a marker holding a drawn number as that number", () => {
    expect(say({ kind: "marker", visibility: "public", label: "drew", value: 5 })).toBe("Marker drew: 5.");
  });
  it("logs a marker holding both sides' answers as each side's yes or no, in SIDES order", () => {
    const value = { sae: false, lio: true };
    expect(say({ kind: "marker", visibility: "public", label: "pick", value })).toBe("Marker pick: LIO yes, SAE no.");
  });
  it("logs a new modifier with the card that made it, its change and how long it lasts", () => {
    const line = say({
      kind: "modifierStarted",
      visibility: "public",
      source: "c4",
      mod: { hook: "opsValue", side: "both", add: -1, min: 1 },
      expires: { kind: "turnEnd", turn: 2 },
    });
    expect(line).toBe("Card C4: ops values for both sides -1, minimum 1, until the end of the turn.");
  });
  it("logs a modifier's end with the card that made it and its change", () => {
    const line = say({
      kind: "modifierEnded",
      visibility: "public",
      source: "c4",
      mod: { hook: "opsValue", side: "sae", add: 2 },
    });
    expect(line).toBe("Card C4's change ended: ops values for SAE +2.");
  });
  it("logs a modifier without a minimum with just its change", () => {
    const line = say({
      kind: "modifierEnded",
      visibility: "public",
      source: "c4",
      mod: { hook: "opsValue", side: "lio", add: -2 },
    });
    expect(line).toBe("Card C4's change ended: ops values for LIO -2.");
  });
  it("logs a rising escalationChanged as a rise to its new value", () => {
    const line = say({
      kind: "escalationChanged",
      visibility: "public",
      from: 3,
      to: 4,
    });
    expect(line).toBe("Escalation rises to 4.");
  });
  it("logs a falling escalationChanged as a fall, not a rise", () => {
    const line = say({
      kind: "escalationChanged",
      visibility: "public",
      from: 2,
      to: 1,
    });
    expect(line).toBe("Escalation falls to 1.");
  });
  it("logs a crisis drop from 6 to 3 as a fall", () => {
    const line = say({
      kind: "escalationChanged",
      visibility: "public",
      from: 6,
      to: 3,
    });
    expect(line).toBe("Escalation falls to 3.");
  });
  it("logs an escalationCrisis with the side that caused it, and the number it drew, leaving the result to the lines after it", () => {
    const line = say({
      kind: "escalationCrisis",
      visibility: "public",
      side: "sae",
      value: 5,
    });
    expect(line).toBe("Crisis: SAE draws 5. The lines that follow show the result.");
  });
  it("logs a regionScored with the region and each side's points", () => {
    expect(say({ kind: "regionScored", visibility: "public", region: "europe", lio: 5, sae: 1 })).toBe(
      "Era scoring, Europe: LIO 5, SAE 1.",
    );
  });
  it.each([
    [-3, "SAE 1", "LIO 3"],
    [2, "SAE 1", "SAE 2"],
    [0, "SAE 1", "even"],
  ])("logs a scoreChanged to %i as from and to, each as the side the track leans towards", (to, was, text) => {
    expect(say({ kind: "scoreChanged", visibility: "public", from: 1, to })).toBe(
      `The score track moves from ${was} to ${text}.`,
    );
  });
  it.each([
    ["triggerSet", "cardPlayed", "Card C4 set a reaction whenever a card is played this turn."],
    ["triggerSet", "turnEnd", "Card C4 set a reaction at the end of this turn."],
    ["triggerFired", "cardPlayed", "Card C4's reaction ran (whenever a card is played this turn)."],
    ["triggerFired", "turnEnd", "Card C4's reaction ran (at the end of this turn)."],
    ["triggerEnded", "cardPlayed", "Card C4's reaction ended (whenever a card is played this turn)."],
  ] as const)("logs %s for a %s trigger with the card that set it and its hook", (kind, hook, expected) => {
    expect(say({ kind, visibility: "public", source: "c4", hook } as never)).toBe(expected);
  });
  it("logs an era the names do not know by its id, as it is", () => {
    expect(say({ kind: "eraStarted", visibility: "public", era: "late", cardsAdded: 2 })).toBe(
      "late started: 2 cards shuffled into the draw pile.",
    );
  });
});
