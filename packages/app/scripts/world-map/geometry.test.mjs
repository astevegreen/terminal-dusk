// What `pnpm map:build` does to Natural Earth's countries (L3, #479), shown on small made-up ones: the UN-recognised
// borders, Crimea, the crop, and whole-number paths without specks.
import { describe, expect, it } from "vitest";
import {
  GAME_COUNTRIES,
  areaOf,
  bordersPath,
  clipRing,
  countriesOf,
  crimeaOf,
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

  // As Natural Earth draws it: Crimea a piece of Russia reaching 46.22°N, sharing its northern edge with Ukraine.
  const ukraine = [
    [30, 46.22],
    [32.5, 46.22],
    [35, 46.22],
    [36, 46.22],
    [36, 52],
    [30, 52],
    [30, 46.22],
  ];
  const crimea = [
    [32.5, 44.4],
    [35, 44.4],
    [35, 46.22],
    [32.5, 46.22],
    [32.5, 44.4],
  ];
  const drawnAsRussia = [feature("UKR", ukraine), feature("RUS", crimea, square(40, 50, 5))];

  it("draws Russia's Crimea as Ukraine's, so no border cuts Crimea from Ukraine", () => {
    const countries = countriesOf(drawnAsRussia);
    expect(countries.get("UKR")).toHaveLength(2);
    expect(countries.get("RUS")).toHaveLength(1);
    expect(bordersPath(countries, flat, everywhere)).toBe("");
  });

  it("gives the game's Crimea that piece's own outline, and Ukraine both", () => {
    const pieces = crimeaOf(drawnAsRussia);
    expect(pieces).toEqual([[crimea]]);
    const shapes = gameShapes(countriesOf(drawnAsRussia), flat, everywhere, pieces);
    expect(shapes["crimea"]).toBe("M33 -44L35 -44L35 -46L33 -46Z");
    expect(shapes["ukraine"]).toContain(shapes["crimea"]);
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

  it("start again at each piece of a country, so no line joins two pieces across the map", () => {
    // AAA's first island ends on a border with BBB, and its second island starts on one.
    const countries = countriesOf([
      feature("AAA", square(0, 0, 2), square(10, 0, 2)),
      feature("BBB", square(-2, 0, 2), square(10, -2, 2)),
    ]);
    expect(bordersPath(countries, flat, everywhere)).toBe("M0 -2L0 0M10 0L12 0");
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

  it("gives every game country a shape, Crimea Ukraine's land in its box when Ukraine holds it, and France only its European land", () => {
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
