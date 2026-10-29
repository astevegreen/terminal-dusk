// Follow-along on the drawn map (L2, #465): the countries a frame's events touched, from the event presentation
// entries that name a country (influence placed, intervened, realigned), each once.
import type { EventKind, GameEvent } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { eventPresentation, touchedCountries } from "./eventPresentation.ts";
import { byCodeUnit } from "./test/order.ts";

const placed = (country: string): GameEvent => ({
  kind: "influencePlaced",
  visibility: "public",
  side: "sae",
  country,
  cost: 1,
});
const intervened: GameEvent = {
  kind: "intervened",
  visibility: "public",
  side: "lio",
  country: "iran",
  stability: 3,
  points: 2,
  draw: 4,
  result: 0,
  removed: 0,
  added: 0,
};
const realigned: GameEvent = {
  kind: "realigned",
  visibility: "public",
  side: "sae",
  country: "poland",
  totals: { lio: 3, sae: 5 },
  loser: "lio",
  removed: 2,
};
const others: GameEvent[] = [
  { kind: "pointsSpent", visibility: "public", side: "sae", amount: 3 },
  { kind: "cardDrawnHidden", visibility: "public", side: "lio" },
  { kind: "escalationChanged", visibility: "public", from: 1, to: 2 },
];

describe("touchedCountries", () => {
  it("gives exactly the countries influence was placed in, each once, in the order first touched", () => {
    expect(touchedCountries([placed("cuba"), ...others, placed("mexico"), placed("cuba")])).toEqual(["cuba", "mexico"]);
  });

  it("adds the country intervened in and the country realigned in", () => {
    expect(touchedCountries([intervened, realigned, placed("iran")])).toEqual(["iran", "poland"]);
  });

  it("is empty for a frame with no events, or only events that touch no country", () => {
    expect(touchedCountries([])).toEqual([]);
    expect(touchedCountries(others)).toEqual([]);
  });

  it("reads a country only from the influencePlaced, intervened and realigned entries", () => {
    const naming = (Object.keys(eventPresentation) as EventKind[]).filter(
      (kind) => "countries" in eventPresentation[kind],
    );
    expect(naming.sort(byCodeUnit)).toEqual(["influencePlaced", "intervened", "realigned"]);
  });
});
