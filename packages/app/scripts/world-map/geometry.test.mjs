// What `pnpm map:build` does to Natural Earth's countries (L3, #479), shown on small made-up ones: the UN-recognised
// borders, Crimea, the crop, and whole-number paths without specks.
import { describe, expect, it } from "vitest";
import {
  GAME_COUNTRIES,
  areaOf,
  bordersPath,
  clipRing,
  countriesOf,
  gameShapes,
  projectorOf,
  rounded,
  shapePath,
} from "./geometry.mjs";
import { CROP, project } from "../../src/game/map/world/projection.ts";

/** A square ring, closed as GeoJSON closes rings. */
const square = (x, y, s) => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
  [x, y],
];
const feature = (code, ...polygons) => ({
  properties: { ADM0_A3: code },
  geometry: { type: "MultiPolygon", coordinates: polygons.map((ring) => [ring]) },
});
/** One unit per degree, north up: the test's own projection. */
const flat = (lon, lat) => ({ x: Math.round(lon), y: Math.round(-lat) + 0 });
const everywhere = { west: -180, east: 180, south: -90, north: 90 };

describe("the projection", () => {
  it("is the one the game's map uses, so the shapes sit on the picture under the markers", () => {
    const built = projectorOf(CROP);
    for (const [lon, lat] of [
      [-125, 72],
      [155, -46],
      [0, 0],
      [34.2, 45.3],
      [-98.6, 39.9],
      [138.5, 36.5],
    ])
      expect(built(lon, lat)).toEqual(project(lon, lat));
  });
});

describe("the UN-recognised borders", () => {
  it("draws Kosovo inside Serbia, Somaliland inside Somalia and Northern Cyprus inside Cyprus", () => {
    const countries = countriesOf([
      feature("SRB", square(0, 0, 4)),
      feature("KOS", square(4, 0, 2)),
      feature("SOM", square(10, 0, 4)),
      feature("SOL", square(10, 4, 2)),
      feature("CYP", square(20, 0, 2)),
      feature("CYN", square(20, 2, 2)),
    ]);
    expect([...countries.keys()].sort()).toEqual(["CYP", "SOM", "SRB"]);
    expect(countries.get("SRB")).toHaveLength(2);
    expect(bordersPath(countries, flat, everywhere)).toBe("");
  });

  it("draws Russia's land in the Crimea box as Ukraine's, so no border cuts Crimea from Ukraine", () => {
    const countries = countriesOf([
      feature("UKR", square(30, 46.15, 4)),
      feature("RUS", square(33, 44.5, 1), square(40, 50, 5)),
    ]);
    expect(countries.get("UKR")).toHaveLength(2);
    expect(countries.get("RUS")).toHaveLength(1);
  });
});

describe("the land borders", () => {
  it("are the edges two countries share, each drawn once, and never a coast", () => {
    const d = bordersPath(
      countriesOf([feature("AAA", square(0, 0, 2)), feature("BBB", square(2, 0, 2))]),
      flat,
      everywhere,
    );
    expect(d).toBe("M2 0L2 -2");
  });

  it("leave out a border wholly outside the crop", () => {
    const countries = countriesOf([feature("AAA", square(0, 0, 2)), feature("BBB", square(2, 0, 2))]);
    expect(bordersPath(countries, flat, { west: 10, east: 20, south: 10, north: 20 })).toBe("");
  });
});

describe("the shapes", () => {
  it("cuts a ring to a box", () => {
    expect(clipRing(square(0, 0, 4), { west: 1, east: 3, south: -10, north: 10 })).toEqual([
      [1, 0],
      [3, 0],
      [3, 4],
      [1, 4],
    ]);
  });

  it("is whole-number lines, with no point repeated and no speck", () => {
    const d = shapePath(
      [
        [square(0, 0, 4)],
        [
          [
            [10, 0],
            [10.2, 0],
            [10.2, 0.2],
            [10, 0.2],
          ],
        ],
      ],
      flat,
      everywhere,
    );
    expect(d).toBe("M0 0L4 0L4 -4L0 -4Z");
    expect(
      rounded(
        [
          [0, 0],
          [0.2, 0.1],
          [1, 0],
          [0, 0.1],
        ],
        flat,
      ),
    ).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(
      areaOf([
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
      ]),
    ).toBe(4);
  });

  it("gives every game country a shape, Crimea Ukraine's land in its box, and France only its European land", () => {
    const features = Object.values(GAME_COUNTRIES).map((code, i) =>
      feature(code, square(-170 + (i % 30) * 10, -60 + Math.floor(i / 30) * 10, 8)),
    );
    features.push(feature("UKR", square(30, 43, 8)), feature("FRA", square(-5, 42, 8), square(-53, 2, 3)));
    const shapes = gameShapes(countriesOf(features), flat, everywhere);
    expect(Object.keys(shapes).sort()).toEqual(Object.keys(GAME_COUNTRIES).sort());
    for (const d of Object.values(shapes)) expect(d).toMatch(/^(M-?\d+ -?\d+(L-?\d+ -?\d+)+Z)+$/);
    expect(shapes["crimea"]).toBe("M32 -46L32 -44L37 -44L37 -46Z");
    expect(shapes["france"]).not.toContain("M-53");
    expect(shapes["france"]).toContain("M-5 -42");
  });
});
