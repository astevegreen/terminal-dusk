import { viewFor } from "@terminal-dusk/engine";
import type { Country, PublicState, RegionAmounts } from "@terminal-dusk/engine";
import { describe, expect, it } from "vitest";
import { boardValue, controlProgress, regionFactor, regionPoints } from "./evaluate.ts";
import { newMapGame } from "./test/mapGames.ts";
import { newGame } from "./test/testGames.ts";
import { MEDIUM_WEIGHTS } from "./weights/medium.ts";

const country = (id: string, stability = 2): Country => ({ id, region: "r", stability }) as unknown as Country;
const amounts = { region: "r", present: 1, ahead: 3, all: 5 } as unknown as RegionAmounts;
const countries = [country("a"), country("b"), country("c")];
const held = (...sides: (("lio" | "sae") | null)[]) => new Map(sides.map((s, i) => [countries[i]!.id, s]));

describe("regionPoints", () => {
  it("gives nothing to a side with no country there", () => {
    expect(regionPoints(amounts, countries, held(null, null, null), new Set())).toEqual({ lio: 0, sae: 0 });
  });

  it("gives present to a side with a country and no lead", () => {
    expect(regionPoints(amounts, countries, held("lio", "sae", null), new Set())).toEqual({ lio: 1, sae: 1 });
  });

  it("gives ahead to the side with more countries, and a point per battleground it holds", () => {
    const pts = regionPoints(amounts, countries, held("lio", "lio", "sae"), new Set(["a", "b", "c"]));
    expect(pts).toEqual({ lio: 3 + 2, sae: 1 + 1 });
  });

  it("is not ahead without the lead in battlegrounds", () => {
    const pts = regionPoints(amounts, countries, held("sae", "lio", "lio"), new Set(["a", "b"]));
    expect(pts).toEqual({ lio: 1 + 1, sae: 1 + 1 });
  });

  it("gives all to the side holding every battleground", () => {
    const pts = regionPoints(amounts, countries, held("lio", "lio", "sae"), new Set(["a", "b"]));
    expect(pts.lio).toBe(5 + 2);
  });
});

describe("controlProgress", () => {
  const pub = (lio: number, sae: number) => ({ influence: [{ country: "a", lio, sae }] }) as unknown as PublicState;
  it("is 0 with no influence there or no entry", () => {
    expect(controlProgress(pub(0, 0), country("a"), "lio")).toBe(0);
    expect(controlProgress({} as PublicState, country("a"), "lio")).toBe(0);
  });
  it("is the share of stability reached by the lead", () => {
    expect(controlProgress(pub(1, 0), country("a", 2), "lio")).toBe(0.5);
    expect(controlProgress(pub(2, 0), country("a", 2), "lio")).toBe(1);
  });
  it("counts the rival's influence against the lead and never goes below 0", () => {
    expect(controlProgress(pub(2, 1), country("a", 2), "lio")).toBe(0.5);
    expect(controlProgress(pub(1, 3), country("a", 2), "lio")).toBe(0);
  });
});

describe("regionFactor", () => {
  it("is 1 for a far region, more for the next to close and most for a closed one", () => {
    const pub = viewFor(newMapGame(1), "lio").public;
    const map = pub.map!;
    const [first, second] = map.closingOrder;
    const far = map.regions.find((r) => !map.closingOrder.slice(0, 1).includes(r.id))!.id;
    expect(regionFactor(pub, first!, MEDIUM_WEIGHTS)).toBe(1 + MEDIUM_WEIGHTS.closed / 2);
    expect(second).toBeDefined();
    expect(regionFactor(pub, far, MEDIUM_WEIGHTS)).toBeGreaterThanOrEqual(1);
    const closed = { ...pub, escalation: 3 };
    expect(regionFactor(closed, first!, MEDIUM_WEIGHTS)).toBe(1 + MEDIUM_WEIGHTS.closed);
  });
});

describe("boardValue", () => {
  it("is 0 on a game with no map scoring", () => {
    expect(boardValue(viewFor(newGame(1), "lio").public, "lio", MEDIUM_WEIGHTS)).toBe(0);
  });

  it("is the negative of the rival's value", () => {
    const pub = viewFor(newMapGame(1), "lio").public;
    expect(boardValue(pub, "lio", MEDIUM_WEIGHTS)).toBeCloseTo(-boardValue(pub, "sae", MEDIUM_WEIGHTS));
  });

  it("rises when the side adds influence to a country it is working to control", () => {
    const pub = viewFor(newMapGame(1), "lio").public;
    const before = boardValue(pub, "lio", MEDIUM_WEIGHTS);
    const influence = pub.influence!.map((e) => (e.country === "test-b1" ? { ...e, lio: e.lio + 1 } : e));
    expect(boardValue({ ...pub, influence }, "lio", MEDIUM_WEIGHTS)).toBeGreaterThan(before);
  });

  it("counts progress in a battleground more when the battleground weight is higher", () => {
    const pub = viewFor(newMapGame(1), "lio").public;
    const gain = (battleground: number): number => {
      const weights = { ...MEDIUM_WEIGHTS, region: 0, battleground };
      const influence = pub.influence!.map((e) => (e.country === "test-b1" ? { ...e, lio: e.lio + 1 } : e));
      return boardValue({ ...pub, influence }, "lio", weights) - boardValue(pub, "lio", weights);
    };
    expect(gain(0)).toBeGreaterThan(0);
    expect(gain(2)).toBeGreaterThan(gain(0));
  });
});

describe("boardValue, the later weight", () => {
  it("counts progress in a country on a later era's battleground list more when the later weight is higher", () => {
    const pub = viewFor(newMapGame(1), "lio").public;
    const map = pub.map!;
    const inNow = new Set(map.battlegrounds.flatMap((l) => l.countries));
    const target = map.countries.find((c) => !inNow.has(c.id))!;
    const withLater = {
      ...pub,
      map: { ...map, battlegrounds: [...map.battlegrounds, { era: "later-era", countries: [target.id] }] },
    };
    const influence = pub.influence!.map((e) => (e.country === target.id ? { ...e, lio: e.lio + 1 } : e));
    const gain = (later: number): number => {
      const weights = { ...MEDIUM_WEIGHTS, region: 0, later };
      return boardValue({ ...withLater, influence }, "lio", weights) - boardValue(withLater, "lio", weights);
    };
    expect(gain(0)).toBeGreaterThan(0);
    expect(gain(1)).toBeGreaterThan(gain(0));
  });
});
