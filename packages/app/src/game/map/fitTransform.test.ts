// The drawn map's view maths (L2, #465): fitting a rectangle to the screen, zooming around a point, panning, and
// the clamps that keep the map between "whole map fits" and 4 times that, never dragged off screen.
import { sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  clampView,
  fitTransform,
  focusTransform,
  minScale,
  panBy,
  pinchFactor,
  revealView,
  transformCss,
  zoomAt,
} from "./fitTransform.ts";
import type { Bounds, View } from "./fitTransform.ts";
import { PICK_SCALE, markerBox } from "./layout.ts";
import { SIX_REGION_LAYOUT } from "./sixRegionLayout.ts";

const content = { w: 1000, h: 560 };
const bounds: Bounds = { content, viewport: { w: 500, h: 400 } };
/** Where a layout point lands on screen. */
const onScreen = (v: View, p: { x: number; y: number }) => ({ x: p.x * v.scale + v.x, y: p.y * v.scale + v.y });

describe("fitTransform", () => {
  it("scales a rectangle to fill the screen in its tighter direction and centres it", () => {
    // 1000x560 into 500x400: width is tighter, scale 0.5; 280 tall, so 60 above and below.
    expect(fitTransform({ x: 0, y: 0, w: 1000, h: 560 }, { w: 500, h: 400 })).toEqual({ scale: 0.5, x: 0, y: 60 });
    // 200x100 at (100, 50) into 500x400: scale min(2.5, 4) = 2.5; 250 tall, centred; the rectangle's corner moves
    // to (0, 75).
    expect(fitTransform({ x: 100, y: 50, w: 200, h: 100 }, { w: 500, h: 400 })).toEqual({
      scale: 2.5,
      x: -250,
      y: -50,
    });
  });

  it("puts the fitted rectangle's corners on the screen's edges in its tighter direction", () => {
    const rect = { x: 236, y: 8, w: 348, h: 196 };
    const view = fitTransform(rect, { w: 545, h: 282 });
    const top = onScreen(view, { x: rect.x, y: rect.y });
    const bottom = onScreen(view, { x: rect.x + rect.w, y: rect.y + rect.h });
    expect(top.y).toBeCloseTo(0);
    expect(bottom.y).toBeCloseTo(282);
    expect((top.x + bottom.x) / 2).toBeCloseTo(545 / 2);
  });

  it("leaves the drawing as it is when the screen or the rectangle has no size", () => {
    expect(fitTransform({ x: 0, y: 0, w: 10, h: 10 }, { w: 0, h: 300 })).toEqual({ scale: 1, x: 0, y: 0 });
    expect(fitTransform({ x: 0, y: 0, w: 0, h: 10 }, { w: 100, h: 300 })).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("writes a view as a CSS transform: move, then scale", () => {
    expect(transformCss({ scale: 0.5, x: 10, y: -20.25 })).toBe("translate(10px, -20.25px) scale(0.5)");
  });
});

describe("clampView", () => {
  it("never zooms out past the whole map fitting, nor in past 4 times that", () => {
    expect(clampView({ scale: 0.1, x: 0, y: 0 }, bounds).scale).toBe(0.5);
    expect(clampView({ scale: 9, x: 0, y: 0 }, bounds).scale).toBe(0.5 * MAX_ZOOM);
    expect(MAX_ZOOM).toBe(4);
  });

  it("keeps a map wider than the screen covering it: no gap at either edge", () => {
    const left = clampView({ scale: 1, x: 300, y: 0 }, bounds);
    expect(left.x).toBe(0);
    const right = clampView({ scale: 1, x: -900, y: 0 }, bounds);
    expect(right.x).toBe(500 - 1000);
  });

  it("keeps a map shorter than the screen wholly on it, so it can't be dragged off", () => {
    expect(clampView({ scale: 0.5, x: 0, y: -100 }, bounds).y).toBe(0);
    expect(clampView({ scale: 0.5, x: 0, y: 500 }, bounds).y).toBe(400 - 280);
  });
});

describe("zoomAt", () => {
  it("keeps the layout point under the cursor where it was", () => {
    const start: View = { scale: 1, x: -200, y: -100 };
    const cursor = { x: 240, y: 150 };
    const under = { x: (cursor.x - start.x) / start.scale, y: (cursor.y - start.y) / start.scale };
    const zoomed = zoomAt(start, 1.5, cursor, bounds);
    expect(zoomed.scale).toBe(1.5);
    expect(onScreen(zoomed, under).x).toBeCloseTo(cursor.x);
    expect(onScreen(zoomed, under).y).toBeCloseTo(cursor.y);
  });

  it("stops at the clamps: zooming out from the whole map changes nothing", () => {
    const whole = fitTransform({ x: 0, y: 0, w: 1000, h: 560 }, bounds.viewport);
    expect(zoomAt(whole, 0.5, { x: 100, y: 100 }, bounds)).toEqual(whole);
    expect(zoomAt({ scale: 1.9, x: 0, y: 0 }, 10, { x: 0, y: 0 }, bounds).scale).toBe(2);
  });
});

describe("panBy", () => {
  it("moves the map by the drag, within the clamps", () => {
    const view: View = { scale: 1, x: -200, y: -50 };
    expect(panBy(view, 30, -10, bounds)).toEqual({ scale: 1, x: -170, y: -60 });
    expect(panBy(view, 1000, 1000, bounds)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe("focusTransform (L7, #487)", () => {
  const size = { w: 500, h: 400 };
  it("fits the region when that already draws a marker at the pick scale", () => {
    const region = { x: 100, y: 100, w: 200, h: 100 };
    expect(focusTransform(region, { x: 150, y: 150 }, size, 1)).toEqual(fitTransform(region, size));
  });
  it("raises the zoom to the pick scale and centres on the country when the region's fit is smaller", () => {
    const region = { x: 0, y: 0, w: 1000, h: 560 };
    const view = focusTransform(region, { x: 800, y: 100 }, size, 1.5);
    expect(view.scale).toBe(1.5);
    expect(onScreen(view, { x: 800, y: 100 })).toEqual({ x: 250, y: 200 });
  });
  it("never zooms past the largest zoom, keeping the region (or the country) in the middle", () => {
    const small = { x: 100, y: 100, w: 50, h: 40 };
    const view = focusTransform(small, { x: 110, y: 110 }, size, 1, 2);
    expect(view.scale).toBe(2);
    expect(onScreen(view, { x: 125, y: 120 })).toEqual({ x: 250, y: 200 });
    const raised = focusTransform({ x: 0, y: 0, w: 1000, h: 560 }, { x: 800, y: 100 }, size, 3, 2);
    expect(raised.scale).toBe(2);
    expect(onScreen(raised, { x: 800, y: 100 })).toEqual({ x: 250, y: 200 });
  });
});

describe("revealView (L7, #487)", () => {
  it("moves the map without zooming just enough to show a marker off the screen, 8 px in from the edge", () => {
    const view: View = { scale: 1, x: -200, y: -50 };
    const marker = { x: 100, y: 60, w: 92, h: 48 };
    const moved = revealView(view, marker, bounds);
    expect(moved.scale).toBe(1);
    expect(onScreen(moved, marker)).toEqual({ x: 8, y: 10 });
    expect(revealView(moved, marker, bounds)).toEqual(moved);
  });
  it("never moves the map off the screen to do it", () => {
    const moved = revealView({ scale: 1, x: 0, y: 0 }, { x: -50, y: 0, w: 20, h: 20 }, bounds);
    expect(moved).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe("every six-region country can be picked once focused (L7, #487)", () => {
  // The drawn map's area at each project size, measured in the browser: the screen less the top bar, the map tools'
  // block (or row), the decision banner and the hand strip.
  const areas = { "844x390": { w: 744, h: 238 }, "1280x800": { w: 1280, h: 584 } };
  const map = sixRegionMapConfig().setup.map!;
  const layout = SIX_REGION_LAYOUT;
  it.each(Object.entries(areas))(
    "at %s, the focus view draws each marker at least 44 px tall, wholly on screen",
    (_, area) => {
      const fits: Bounds = { content: layout.size, viewport: area };
      for (const country of map.countries) {
        const at = layout.countries[country.id]!;
        const largest = minScale(fits) * MAX_ZOOM;
        const view = clampView(focusTransform(layout.regions[country.region]!, at, area, PICK_SCALE, largest), fits);
        const box = markerBox(at);
        const topLeft = onScreen(view, box);
        const height = box.h * view.scale;
        expect(height, country.id).toBeGreaterThanOrEqual(44 - 1e-9);
        expect(topLeft.x, country.id).toBeGreaterThanOrEqual(0);
        expect(topLeft.y, country.id).toBeGreaterThanOrEqual(0);
        expect(topLeft.x + box.w * view.scale, country.id).toBeLessThanOrEqual(area.w);
        expect(topLeft.y + height, country.id).toBeLessThanOrEqual(area.h);
      }
    },
  );
  it("needs a zoom at both sizes: the whole map draws a marker under 44 px tall, so a first tap zooms", () => {
    for (const area of Object.values(areas))
      expect(minScale({ content: layout.size, viewport: area }) * 48).toBeLessThan(44);
  });
});

describe("pinchFactor", () => {
  it("is the ratio of the fingers' distance now to their distance before", () => {
    const before: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 0, y: 0 },
      { x: 30, y: 40 },
    ];
    expect(
      pinchFactor(before, [
        { x: 0, y: 0 },
        { x: 60, y: 80 },
      ]),
    ).toBe(2);
    expect(
      pinchFactor(before, [
        { x: 10, y: 10 },
        { x: 25, y: 30 },
      ]),
    ).toBe(0.5);
    expect(
      pinchFactor(
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        before,
      ),
    ).toBe(1);
  });
});
