// The six-region map's drawing (L2, #465): a placeholder, flat and hand-placed. The Americas on the left; Europe,
// the Middle East and North Africa, and Sub-Saharan Africa in the middle; Eastern Europe and Central Asia, and East
// and South Asia on the right. Each country sits at a rough real-world position inside its region, and no two
// markers overlap at any zoom (sixRegionLayout.test.ts). Positions are marker centres in a 1000 by 560 space.
import type { MapLayout } from "./layout.ts";

export const SIX_REGION_LAYOUT: MapLayout = {
  size: { w: 1000, h: 560 },
  regions: {
    americas: { x: 8, y: 8, w: 216, h: 544 },
    europe: { x: 236, y: 8, w: 348, h: 196 },
    "middle-east-north-africa": { x: 236, y: 212, w: 348, h: 196 },
    "sub-saharan-africa": { x: 236, y: 416, w: 348, h: 136 },
    "eastern-europe-central-asia": { x: 596, y: 8, w: 396, h: 240 },
    "east-south-asia": { x: 596, y: 256, w: 396, h: 296 },
  },
  countries: {
    // The Americas
    canada: { x: 116, y: 64 },
    mexico: { x: 70, y: 240 },
    cuba: { x: 172, y: 290 },
    venezuela: { x: 124, y: 380 },
    brazil: { x: 150, y: 482 },
    // Europe
    "united-kingdom": { x: 290, y: 60 },
    finland: { x: 530, y: 60 },
    france: { x: 290, y: 114 },
    germany: { x: 400, y: 114 },
    poland: { x: 530, y: 114 },
    italy: { x: 340, y: 172 },
    serbia: { x: 440, y: 172 },
    greece: { x: 536, y: 172 },
    // The Middle East and North Africa
    turkey: { x: 360, y: 264 },
    iran: { x: 536, y: 264 },
    lebanon: { x: 340, y: 318 },
    syria: { x: 440, y: 318 },
    iraq: { x: 536, y: 318 },
    libya: { x: 284, y: 376 },
    israel: { x: 380, y: 376 },
    "saudi-arabia": { x: 500, y: 376 },
    // Sub-Saharan Africa
    nigeria: { x: 300, y: 468 },
    rwanda: { x: 420, y: 468 },
    somalia: { x: 530, y: 468 },
    "south-africa": { x: 430, y: 524 },
    // Eastern Europe and Central Asia
    estonia: { x: 646, y: 60 },
    belarus: { x: 646, y: 114 },
    ukraine: { x: 646, y: 168 },
    crimea: { x: 660, y: 222 },
    georgia: { x: 754, y: 200 },
    azerbaijan: { x: 848, y: 214 },
    kazakhstan: { x: 870, y: 100 },
    kyrgyzstan: { x: 944, y: 160 },
    tajikistan: { x: 944, y: 218 },
    // East and South Asia
    afghanistan: { x: 650, y: 310 },
    pakistan: { x: 660, y: 370 },
    india: { x: 730, y: 440 },
    "north-korea": { x: 850, y: 310 },
    "south-korea": { x: 850, y: 370 },
    japan: { x: 944, y: 340 },
    taiwan: { x: 890, y: 440 },
    australia: { x: 900, y: 512 },
  },
  homes: {
    lio: { x: 84, y: 150 },
    sae: { x: 760, y: 70 },
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
};
