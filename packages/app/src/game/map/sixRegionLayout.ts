// The six-region map's drawing (L2, #465; real geography since L3, #479). It is drawn on the world picture's 1960 by
// 826 units (world/projection.ts). Each country has its true place from its longitude and latitude, and a marker at
// or near it, inside its region's rectangle. The rectangles are the regions' tap zones and do not overlap: the
// Americas on the left, Europe and Eastern Europe across the top, the Middle East and Africa below them, Asia on the
// right. A crowded country's marker sits a little away, joined to its place by a leader line. No two markers overlap
// (sixRegionLayout.test.ts). Positions are marker centres.
import type { CountryId } from "@terminal-dusk/engine";
import type { MapLayout, Point } from "./layout.ts";
import { WORLD_SIZE, project } from "./world/projection.ts";

/** Each country's true place, as longitude and latitude in degrees (east and north positive). */
const LON_LAT: Readonly<Record<CountryId, readonly [number, number]>> = {
  canada: [-100, 56],
  mexico: [-102, 23.5],
  cuba: [-79, 21.8],
  venezuela: [-66, 7.5],
  brazil: [-50, -10],
  "united-kingdom": [-1.5, 52.5],
  finland: [26, 63],
  france: [2.5, 46.8],
  germany: [10.4, 51.1],
  poland: [19.4, 52.1],
  italy: [12.5, 42.8],
  serbia: [20.8, 44],
  greece: [22, 39.5],
  turkey: [35, 39],
  iran: [54, 32.5],
  lebanon: [35.9, 33.9],
  syria: [38.5, 35],
  iraq: [43.8, 33],
  libya: [17.5, 27],
  israel: [34.8, 31],
  "saudi-arabia": [44.5, 24],
  nigeria: [8, 9.5],
  rwanda: [29.9, -2],
  somalia: [45.5, 4.5],
  "south-africa": [23, -30],
  estonia: [25.5, 58.7],
  belarus: [28, 53.5],
  ukraine: [31.5, 49],
  crimea: [34.2, 45.3],
  georgia: [43.5, 42.2],
  azerbaijan: [47.7, 40.3],
  kazakhstan: [67, 48],
  kyrgyzstan: [74.5, 41.5],
  tajikistan: [71, 38.6],
  afghanistan: [66, 33.8],
  pakistan: [69.5, 29.5],
  india: [78.5, 22],
  "north-korea": [127, 40.2],
  "south-korea": [128, 36.3],
  japan: [138.5, 36.5],
  taiwan: [121, 23.7],
  australia: [134, -25],
};

const places: Record<CountryId, Point> = Object.fromEntries(
  Object.entries(LON_LAT).map(([id, [lon, lat]]) => [id, project(lon, lat)]),
);

export const SIX_REGION_LAYOUT: MapLayout = {
  size: WORLD_SIZE,
  regions: {
    americas: { x: 0, y: 0, w: 651, h: 826 },
    europe: { x: 665, y: 0, w: 378, h: 236 },
    "middle-east-north-africa": { x: 735, y: 236, w: 574, h: 184 },
    "sub-saharan-africa": { x: 735, y: 420, w: 574, h: 406 },
    "eastern-europe-central-asia": { x: 1043, y: 0, w: 462, h: 236 },
    "east-south-asia": { x: 1309, y: 236, w: 651, h: 590 },
  },
  countries: {
    // The Americas: every marker on its place.
    canada: places["canada"]!,
    mexico: places["mexico"]!,
    cuba: places["cuba"]!,
    venezuela: places["venezuela"]!,
    brazil: places["brazil"]!,
    // Europe: four rows across the Atlantic and the Continent.
    finland: { x: 997, y: 50 },
    "united-kingdom": { x: 805, y: 134 },
    germany: { x: 901, y: 104 },
    poland: { x: 997, y: 104 },
    france: { x: 901, y: 158 },
    serbia: { x: 997, y: 158 },
    italy: { x: 901, y: 212 },
    greece: { x: 997, y: 212 },
    // The Middle East and North Africa: the Levant spread west over the Mediterranean.
    turkey: { x: 1071, y: 286 },
    syria: { x: 1167, y: 286 },
    iran: { x: 1263, y: 286 },
    libya: { x: 975, y: 340 },
    lebanon: { x: 1071, y: 340 },
    iraq: { x: 1167, y: 340 },
    israel: { x: 1071, y: 394 },
    "saudi-arabia": { x: 1167, y: 394 },
    // Sub-Saharan Africa.
    nigeria: { x: 931, y: 470 },
    rwanda: places["rwanda"]!,
    somalia: places["somalia"]!,
    "south-africa": places["south-africa"]!,
    // Eastern Europe and Central Asia: the Baltic down to Crimea in one column, the Caucasus and Central Asia east.
    estonia: { x: 1089, y: 50 },
    belarus: { x: 1089, y: 104 },
    ukraine: { x: 1089, y: 158 },
    crimea: { x: 1089, y: 212 },
    georgia: { x: 1182, y: 212 },
    azerbaijan: { x: 1274, y: 212 },
    kazakhstan: { x: 1367, y: 158 },
    tajikistan: { x: 1367, y: 212 },
    kyrgyzstan: { x: 1459, y: 212 },
    // East and South Asia.
    afghanistan: { x: 1355, y: 286 },
    pakistan: { x: 1355, y: 340 },
    india: { x: 1451, y: 340 },
    "north-korea": { x: 1764, y: 286 },
    "south-korea": { x: 1764, y: 340 },
    japan: { x: 1860, y: 300 },
    taiwan: { x: 1722, y: 394 },
    australia: places["australia"]!,
  },
  homes: {
    // LIO's home over North America, SAE's over Siberia: neither is a country of the game.
    lio: project(-98, 40),
    sae: project(110, 60),
  },
  short: {
    "united-kingdom": "UK",
    "saudi-arabia": "S. Arabia",
    "south-africa": "S. Africa",
    "north-korea": "N. Korea",
    "south-korea": "S. Korea",
    afghanistan: "Afghan.",
    azerbaijan: "Azerb.",
    kazakhstan: "Kazakh.",
    kyrgyzstan: "Kyrgyz.",
    tajikistan: "Tajik.",
  },
  places,
};
