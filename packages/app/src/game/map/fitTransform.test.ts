// The drawn map's view maths (L2, #465): fitting a rectangle to the screen, zooming around a point, panning, and
// the clamps that keep the map between "whole map fits" and 4 times that, never dragged off screen.
import { describe, expect, it } from "vitest";
import { MAX_ZOOM, clampView, fitTransform, panBy, pinchFactor, transformCss, zoomAt } from "./fitTransform.ts";
import type { Bounds, View } from "./fitTransform.ts";

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
