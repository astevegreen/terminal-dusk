// R21: how one region scores at an era's end (docs/design/map-and-points.md, "Scoring"). A side is present with one
// country, ahead with more countries and more battlegrounds than the rival (more countries, in a region with no
// battlegrounds), and holds every battleground when it controls all of them. It scores its highest level only, plus 1
// for each battleground it controls. The battlegrounds are the list of the era that is ending (`public.era`).
import { describe, expect, it } from "vitest";
import { regionScore } from "./scoring.ts";
import type { CountryId, PublicState, RegionAmounts, SetupMap } from "./types.ts";
import { testMap } from "./test/map.ts";
import { mapState } from "./mapChecks.ts";

/** Made-up amounts, each level its own number so a test can tell them apart. */
const AMOUNTS: RegionAmounts = { region: "north", present: 1, ahead: 3, all: 5 };

type Counts = Record<CountryId, { lio?: number; sae?: number }>;

/**
 * The public parts regionScore reads: the test map with era-1's battlegrounds set to `battlegrounds`, `era` as the
 * current era, and influence from `counts` (0 where none is given). Stabilities: alpha 2, bravo 1, charlie 3 (north),
 * delta 2, echo 1 (south), foxtrot 1 (east).
 */
function publicWith(counts: Counts, battlegrounds: CountryId[], era = "era-1"): PublicState {
  const setupMap: SetupMap = {
    ...testMap(),
    battlegrounds: [
      { era: "era-1", countries: battlegrounds },
      { era: "era-2", countries: [] },
    ],
  };
  const { map } = mapState(setupMap);
  const influence = map.countries.map(({ id }) => ({
    country: id,
    lio: counts[id]?.lio ?? 0,
    sae: counts[id]?.sae ?? 0,
  }));
  return { map, influence, era } as PublicState;
}

describe("regionScore: one region's points for each side", () => {
  it("a region where nobody controls anything scores 0 for both", () => {
    expect(regionScore(publicWith({}, ["alpha", "charlie"]), AMOUNTS)).toEqual({ lio: 0, sae: 0 });
  });

  it("controlling one country that is not a battleground is present only", () => {
    expect(regionScore(publicWith({ bravo: { lio: 1 } }, ["alpha", "charlie"]), AMOUNTS)).toEqual({ lio: 1, sae: 0 });
  });

  it("more countries but not more battlegrounds is present, not ahead; each battleground adds 1", () => {
    // LIO: alpha (battleground) and bravo; SAE: charlie (battleground). Countries 2 to 1, battlegrounds 1 to 1.
    const pub = publicWith({ alpha: { lio: 2 }, bravo: { lio: 1 }, charlie: { sae: 3 } }, ["alpha", "charlie"]);
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 1 + 1, sae: 1 + 1 });
  });

  it("more countries and more battlegrounds is ahead, plus 1 for its battleground", () => {
    const pub = publicWith({ alpha: { lio: 2 }, bravo: { lio: 1 } }, ["alpha", "charlie"]);
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 3 + 1, sae: 0 });
  });

  it("controlling every battleground scores that level only, not ahead's on top, plus 1 for each", () => {
    const pub = publicWith({ alpha: { lio: 2 }, charlie: { lio: 3 } }, ["alpha", "charlie"]);
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 5 + 2, sae: 0 });
  });

  it("holding every battleground counts even when the rival controls more countries", () => {
    // Battleground charlie is LIO's; SAE has alpha and bravo: more countries, fewer battlegrounds, so only present.
    const pub = publicWith({ charlie: { lio: 3 }, alpha: { sae: 2 }, bravo: { sae: 1 } }, ["charlie"]);
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 5 + 1, sae: 1 });
  });

  it("a region with no battlegrounds scores on countries only: more countries is ahead, never every battleground", () => {
    const pub = publicWith({ alpha: { lio: 2 }, bravo: { lio: 1 }, charlie: { sae: 3 } }, []);
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 3, sae: 1 });
  });

  it("equal countries in a region with no battlegrounds is present for both", () => {
    const pub = publicWith({ alpha: { lio: 2 }, charlie: { sae: 3 } }, []);
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 1, sae: 1 });
  });

  it("uses the current era's battleground list", () => {
    // In era-2 north has no battlegrounds, so alpha and bravo are ahead on countries, with no battleground bonus.
    const pub = publicWith({ alpha: { lio: 2 }, bravo: { lio: 1 } }, ["alpha", "charlie"], "era-2");
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 3, sae: 0 });
  });

  it("counts only countries in its own region", () => {
    // Delta and echo are in the south: they do not make LIO present in the north.
    const pub = publicWith({ delta: { lio: 2 }, echo: { lio: 1 } }, ["alpha", "charlie", "delta"]);
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 0, sae: 0 });
  });

  it("influence below control counts for nothing", () => {
    const pub = publicWith({ alpha: { lio: 1 }, charlie: { lio: 3, sae: 1 } }, ["alpha", "charlie"]);
    expect(regionScore(pub, AMOUNTS)).toEqual({ lio: 0, sae: 0 });
  });
});
