// The world map's projection (L3, #479): the Blue Marble picture is equirectangular, so a place's longitude and
// latitude map straight to layout units, 7 to the degree, inside the crop in crop.json. The build script
// (scripts/world-map/build.mjs) crops the picture and draws the borders from the same crop.json, so both line up.
import type { Point, Size } from "../layout.ts";
import crop from "./crop.json" with { type: "json" };

export const CROP = crop;

/** The world drawing's size in layout units: the crop's width and height in degrees, 7 units to each. */
export const WORLD_SIZE: Size = {
  w: (crop.east - crop.west) * crop.unitsPerDegree,
  h: (crop.north - crop.south) * crop.unitsPerDegree,
};

/** Where a longitude and latitude (degrees, east and north positive) fall in the drawing, in whole units. */
export const project = (lon: number, lat: number): Point => ({
  x: Math.round((lon - crop.west) * crop.unitsPerDegree),
  y: Math.round((crop.north - lat) * crop.unitsPerDegree),
});
