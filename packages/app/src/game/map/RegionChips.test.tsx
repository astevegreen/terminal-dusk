// Region standings on the map (L8, #488): under each region's name, a chip shows how each side stands there now, in
// the words of docs/design/map-and-points.md (present, ahead, holds every battleground), and the points the region
// would give each side if it scored now, from the engine's regionStanding (whose points are regionScore's, proved in
// the engine's regionScore.test.ts). Public information only, and nothing on a map without scoring.
import type { InfluenceEntry, PublicState, RegionStanding } from "@terminal-dusk/engine";
import { regionStanding, sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import { treeOf } from "../../online/test/screenTree.ts";
import { baseFrame, withMap } from "../test/mapFixture.ts";
import { chipPlaces } from "./chipPlaces.ts";
import { RegionChips, standingLabel, standingLine } from "./RegionChips.tsx";
import { renderToString } from "react-dom/server";
import { SIX_REGION_LAYOUT } from "./sixRegionLayout.ts";

const fixturePub: PublicState = withMap(baseFrame()).view.public;
const sixMap = sixRegionMapConfig().setup.map!;
const era = sixMap.battlegrounds[0]!.era;

/** The six-region map in its first era with `influence`: Europe's battlegrounds are Germany, Poland and Serbia. */
const pubWith = (influence: InfluenceEntry[]): PublicState => ({ ...fixturePub, map: sixMap, era, influence });

/** Each chip's two lines, LIO's then SAE's, by region id, as a player sees them. */
function chipsOf(pub: PublicState): Map<string, string[]> {
  const html = renderToString(<RegionChips pub={pub} layout={SIX_REGION_LAYOUT} />);
  const chips = [...html.matchAll(/<li class="dm-chip" data-region="([^"]+)"[^>]*>(.*?)<\/li>/g)];
  return new Map(
    chips.map(([, id, inner]) => [
      id!,
      [...inner!.matchAll(/<span class="dm-chip-side"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]!),
    ]),
  );
}
const europe = (pub: PublicState): string[] => chipsOf(pub).get("europe")!;

const standing = (lio: RegionStanding["lio"], sae: RegionStanding["sae"]): RegionStanding => ({ lio, sae });

describe("a standings chip's words, for each level and each side", () => {
  for (const side of ["lio", "sae"] as const) {
    const name = side.toUpperCase();
    it(`${name}: nothing shows only its points, 0`, () => {
      expect(standingLine(side, { level: "none", points: 0 })).toBe(`${name} 0`);
    });
    it(`${name}: present, ahead and holds every battleground, each with its points`, () => {
      expect(standingLine(side, { level: "present", points: 3 })).toBe(`${name} present 3`);
      expect(standingLine(side, { level: "ahead", points: 6 })).toBe(`${name} ahead 6`);
      expect(standingLine(side, { level: "all", points: 11 })).toBe(`${name} every battleground 11`);
    });
  }

  it("reads aloud as the region's name, then each side's level in full and its points", () => {
    const s = standing({ level: "all", points: 11 }, { level: "none", points: 0 });
    expect(standingLabel("Europe", s)).toBe(
      "Europe, if it scored now: LIO holds every battleground, 11 points; SAE 0 points.",
    );
    expect(standingLabel("Europe", standing({ level: "present", points: 2 }, { level: "ahead", points: 6 }))).toBe(
      "Europe, if it scored now: LIO present, 2 points; SAE ahead, 6 points.",
    );
  });
});

describe("the chips on the six-region map", () => {
  it("draws one chip per region, in the map's order, each at its place under the region's name", () => {
    const html = renderToString(<RegionChips pub={pubWith([])} layout={SIX_REGION_LAYOUT} />);
    const ids = [...html.matchAll(/<li class="dm-chip" data-region="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(sixMap.regions.map((r) => r.id));
    const at = chipPlaces(SIX_REGION_LAYOUT)["europe"]!;
    expect(html).toContain(`left:${at.x}px;top:${at.y}px`);
  });

  it("shows nothing for both sides where neither controls a country", () => {
    expect(europe(pubWith([]))).toEqual(["LIO 0", "SAE 0"]);
  });

  it("shows each level for LIO, with the region's points (Europe: 2, 5 or 8, plus 1 per battleground)", () => {
    // Italy (stability 3) is not a battleground; Poland (3) and Germany (4) and Serbia (2) are.
    expect(europe(pubWith([{ country: "italy", lio: 3, sae: 0 }]))).toEqual(["LIO present 2", "SAE 0"]);
    const ahead = pubWith([
      { country: "italy", lio: 3, sae: 0 },
      { country: "poland", lio: 3, sae: 0 },
    ]);
    expect(europe(ahead)).toEqual(["LIO ahead 6", "SAE 0"]);
    const all = pubWith([
      { country: "germany", lio: 4, sae: 0 },
      { country: "poland", lio: 3, sae: 0 },
      { country: "serbia", lio: 2, sae: 0 },
    ]);
    expect(europe(all)).toEqual(["LIO every battleground 11", "SAE 0"]);
  });

  it("shows each level for SAE, the same way", () => {
    expect(europe(pubWith([{ country: "greece", lio: 0, sae: 3 }]))).toEqual(["LIO 0", "SAE present 2"]);
    const ahead = pubWith([
      { country: "greece", lio: 0, sae: 3 },
      { country: "serbia", lio: 0, sae: 2 },
      { country: "italy", lio: 3, sae: 0 },
    ]);
    expect(europe(ahead)).toEqual(["LIO present 2", "SAE ahead 6"]);
    const all = pubWith([
      { country: "germany", lio: 0, sae: 4 },
      { country: "poland", lio: 0, sae: 3 },
      { country: "serbia", lio: 0, sae: 2 },
    ]);
    expect(europe(all)).toEqual(["LIO 0", "SAE every battleground 11"]);
  });

  it("shows the points the engine works out for every region, whatever the influence", () => {
    const pub = pubWith([
      { country: "taiwan", lio: 3, sae: 0 },
      { country: "crimea", lio: 0, sae: 2 },
      { country: "mexico", lio: 2, sae: 0 },
      { country: "nigeria", lio: 0, sae: 1 },
      { country: "iran", lio: 0, sae: 3 },
    ]);
    const chips = chipsOf(pub);
    for (const amounts of sixMap.scoring!.regions) {
      const s = regionStanding(pub, amounts);
      expect(chips.get(amounts.region)).toEqual([standingLine("lio", s.lio), standingLine("sae", s.sae)]);
    }
  });

  it("changes when influence changes control", () => {
    expect(europe(pubWith([{ country: "italy", lio: 2, sae: 0 }]))).toEqual(["LIO 0", "SAE 0"]);
    expect(europe(pubWith([{ country: "italy", lio: 3, sae: 0 }]))).toEqual(["LIO present 2", "SAE 0"]);
  });

  it("colours each line by its side and marks its level, for the stylesheet", () => {
    const html = renderToString(<RegionChips pub={pubWith([])} layout={SIX_REGION_LAYOUT} />);
    expect(html).toContain('<span class="dm-chip-side" data-side="lio" data-level="none" aria-hidden="true">');
    expect(html).toContain('<span class="dm-chip-side" data-side="sae" data-level="none" aria-hidden="true">');
  });

  it("gives a reader the whole standing, and lets taps through to the region under it", () => {
    const element = <RegionChips pub={pubWith([])} layout={SIX_REGION_LAYOUT} />;
    expect(renderToString(element)).toContain(
      '<span class="dm-sr">Europe, if it scored now: LIO 0 points; SAE 0 points.</span>',
    );
    expect(renderToString(element)).toMatch(/^<ul class="dm-chips" aria-label="Region standings">/);
    expect(treeOf(element).buttons).toHaveLength(0);
  });
});

describe("no chips", () => {
  it("on a map without scoring", () => {
    const pub = withMap(baseFrame()).view.public;
    expect(pub.map?.scoring).toBeUndefined();
    expect(renderToString(<RegionChips pub={pub} layout={SIX_REGION_LAYOUT} />)).toBe("");
  });
});
