// The choices that name a country (L7, #487): built only from the decision's options, in their order, and named by
// the map's names, never by the countries' ids.
import type { Decision, DecisionOptions, GameMap } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { countryChoices, countryNames, picksByCountry } from "./countryChoices.ts";

const decision = (kind: Decision["kind"], options: DecisionOptions): Decision => ({
  id: "d1",
  side: "lio",
  kind,
  options,
});
const map = {
  regions: [],
  countries: [
    { id: "ukraine", name: "Ukraine", region: "europe", stability: 2, neighbours: [] },
    { id: "s-korea", name: "South Korea", region: "asia", stability: 3, neighbours: [] },
  ],
} as unknown as GameMap;
const names = countryNames(map);

describe("countryNames", () => {
  it("gives each country its name from the map", () => {
    expect(names("ukraine")).toBe("Ukraine");
    expect(names("s-korea")).toBe("South Korea");
  });
  it("falls back to the id only for a country the map lacks, or with no map", () => {
    expect(names("atlantis")).toBe("atlantis");
    expect(countryNames(undefined)("ukraine")).toBe("ukraine");
  });
});

describe("countryChoices", () => {
  it("a placing: one choice per listed country, in order, named, sending that country", () => {
    expect(countryChoices(decision("placeInfluence", { points: 3, countries: ["s-korea", "ukraine"] }), names)).toEqual(
      [
        { text: "Place in South Korea", value: { kind: "placeInfluence", country: "s-korea" }, country: "s-korea" },
        { text: "Place in Ukraine", value: { kind: "placeInfluence", country: "ukraine" }, country: "ukraine" },
      ],
    );
  });
  it("the action menu: one choice per intervention target, only when it offers an intervention", () => {
    const menu = { points: 2, actions: ["place", "intervene"], targets: ["ukraine"] } as DecisionOptions;
    expect(countryChoices(decision("chooseAction", menu), names)).toEqual([
      {
        text: "Intervene in Ukraine",
        value: { kind: "chooseAction", action: "intervene", country: "ukraine" },
        country: "ukraine",
      },
    ]);
    const noIntervention = { points: 2, actions: ["place", "realign"], targets: ["ukraine"] } as DecisionOptions;
    expect(countryChoices(decision("chooseAction", noIntervention), names)).toEqual([]);
  });
  it("a realignment: one choice per target (stopping is not a country)", () => {
    expect(countryChoices(decision("realign", { attempts: 2, targets: ["ukraine"] }), names)).toEqual([
      { text: "Realign in Ukraine", value: { kind: "realign", country: "ukraine" }, country: "ukraine" },
    ]);
  });
  it("is empty for a decision that names no country", () => {
    expect(countryChoices(decision("yesNo", {}), names)).toEqual([]);
    expect(
      countryChoices(decision("playCardAs", { from: "hand", uses: { own: [], rival: [], neutral: [] } }), names),
    ).toEqual([]);
  });
});

describe("picksByCountry", () => {
  it("keys the country choices by their country and leaves out the rest", () => {
    const picks = picksByCountry([
      { text: "Place influence", value: { kind: "chooseAction", action: "place" } },
      ...countryChoices(decision("chooseAction", { points: 1, actions: ["intervene"], targets: ["ukraine"] }), names),
    ]);
    expect([...picks.keys()]).toEqual(["ukraine"]);
    expect(picks.get("ukraine")?.text).toBe("Intervene in Ukraine");
  });
});
