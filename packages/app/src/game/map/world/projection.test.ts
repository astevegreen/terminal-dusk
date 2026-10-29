// The world map's projection (L3, #479): the crop's corners land on the drawing's corners, in whole units.
import { describe, expect, it } from "vitest";
import { CROP, WORLD_SIZE, project } from "./projection.ts";

describe("the world projection", () => {
  it("is 1960 by 826 units: 280 by 118 degrees at 7 units each", () => {
    expect(WORLD_SIZE).toEqual({ w: 1960, h: 826 });
  });

  it("puts the crop's top left corner at 0,0 and its bottom right at the drawing's size", () => {
    expect(project(CROP.west, CROP.north)).toEqual({ x: 0, y: 0 });
    expect(project(CROP.east, CROP.south)).toEqual({ x: 1960, y: 826 });
  });

  it("rounds a place to whole units, east and north positive", () => {
    expect(project(0, 0)).toEqual({ x: 875, y: 504 });
    expect(project(34.2, 45.3)).toEqual({ x: 1114, y: 187 });
  });
});
