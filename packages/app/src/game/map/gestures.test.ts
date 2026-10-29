// The drawn map's gestures (L2, #465), as pure steps: a tap stays a tap until the pointer has moved 6 px, then it
// drags the map; two fingers pinch, zooming around their midpoint; the wheel zooms by a factor from its delta.
import { describe, expect, it } from "vitest";
import { clampView, fitTransform } from "./fitTransform.ts";
import type { Bounds, View } from "./fitTransform.ts";
import { DRAG_THRESHOLD, NO_GESTURE, pointerDown, pointerMove, pointerUp, wheelFactor } from "./gestures.ts";
import type { Gesture } from "./gestures.ts";

const bounds: Bounds = { content: { w: 1000, h: 560 }, viewport: { w: 500, h: 400 } };
/** Zoomed in to twice the whole map, so there is room to move in both directions. */
const zoomed: View = clampView({ scale: 1, x: -200, y: -100 }, bounds);
const onScreen = (v: View, p: { x: number; y: number }) => ({ x: p.x * v.scale + v.x, y: p.y * v.scale + v.y });
const underScreen = (v: View, p: { x: number; y: number }) => ({ x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale });

/** Runs moves of pointer `id` in turn from `view`, giving the last gesture and view. */
function moves(gesture: Gesture, view: View, id: number, points: { x: number; y: number }[]) {
  let state = { gesture, view };
  for (const at of points) state = pointerMove(state.gesture, id, at, state.view, bounds);
  return state;
}

describe("one pointer", () => {
  it("is a tap while it moves less than the drag threshold: the map does not move", () => {
    const down = pointerDown(NO_GESTURE, 1, { x: 100, y: 100 });
    const { gesture, view } = moves(down, zoomed, 1, [
      { x: 103, y: 102 },
      { x: 105, y: 100 },
    ]);
    expect(view).toEqual(zoomed);
    expect(gesture.dragging).toBe(false);
    expect(DRAG_THRESHOLD).toBe(6);
  });

  it("drags the map once it has moved the threshold, by the whole move from where it went down", () => {
    const down = pointerDown(NO_GESTURE, 1, { x: 100, y: 100 });
    const { gesture, view } = moves(down, zoomed, 1, [
      { x: 103, y: 100 },
      { x: 110, y: 104 },
      { x: 120, y: 90 },
    ]);
    expect(gesture.dragging).toBe(true);
    expect(view).toEqual({ ...zoomed, x: zoomed.x + 20, y: zoomed.y - 10 });
  });

  it("stays a drag after it lifts, so the click that follows is not a tap, until the next pointer goes down", () => {
    const dragged = moves(pointerDown(NO_GESTURE, 1, { x: 100, y: 100 }), zoomed, 1, [{ x: 140, y: 100 }]);
    const up = pointerUp(dragged.gesture, 1);
    expect(up.pointers).toEqual([]);
    expect(up.dragging).toBe(true);
    expect(pointerDown(up, 2, { x: 0, y: 0 }).dragging).toBe(false);
  });

  it("is kept within the clamps: the map can't be dragged off screen", () => {
    const down = pointerDown(NO_GESTURE, 1, { x: 100, y: 100 });
    const { view } = moves(down, zoomed, 1, [{ x: 2000, y: 2000 }]);
    expect(view).toEqual({ ...zoomed, x: 0, y: 0 });
  });

  it("ignores moves of a pointer that never went down on the map", () => {
    const down = pointerDown(NO_GESTURE, 1, { x: 100, y: 100 });
    expect(pointerMove(down, 7, { x: 300, y: 300 }, zoomed, bounds)).toEqual({ gesture: down, view: zoomed });
  });
});

describe("two fingers", () => {
  const start = (): Gesture => pointerDown(pointerDown(NO_GESTURE, 1, { x: 200, y: 200 }), 2, { x: 300, y: 200 });

  it("a second finger makes it a pinch, never a tap", () => {
    expect(start().dragging).toBe(true);
    expect(start().pointers.map((p) => p.id)).toEqual([1, 2]);
  });

  it("spreading them twice as far apart doubles the zoom, around their midpoint", () => {
    const whole = fitTransform({ x: 0, y: 0, ...bounds.content }, bounds.viewport);
    const mid = { x: 250, y: 200 };
    const under = underScreen(whole, mid);
    // Finger 2 moves from 100 px away from finger 1 to 200 px away: the midpoint moves too, by 50 px.
    const { view } = pointerMove(start(), 2, { x: 400, y: 200 }, whole, bounds);
    expect(view.scale).toBeCloseTo(whole.scale * 2);
    // The layout point that was under the old midpoint is now under the new one, (300, 200).
    expect(onScreen(view, under).x).toBeCloseTo(300);
    expect(onScreen(view, under).y).toBeCloseTo(200);
  });

  it("pinching them together never zooms out past the whole map", () => {
    const whole = fitTransform({ x: 0, y: 0, ...bounds.content }, bounds.viewport);
    const { view } = pointerMove(start(), 2, { x: 210, y: 200 }, whole, bounds);
    expect(view.scale).toBe(whole.scale);
  });

  it("lifting one finger leaves the other dragging from where it is", () => {
    const one = pointerUp(start(), 1);
    expect(one.pointers).toEqual([{ id: 2, at: { x: 300, y: 200 } }]);
    const { view } = pointerMove(one, 2, { x: 310, y: 205 }, zoomed, bounds);
    expect(view).toEqual({ ...zoomed, x: zoomed.x + 10, y: zoomed.y + 5 });
  });

  it("a third finger is not tracked", () => {
    expect(pointerDown(start(), 3, { x: 0, y: 0 }).pointers).toHaveLength(2);
  });
});

describe("the wheel", () => {
  it("zooms in for a wheel turned away from the user and out for one turned towards them, evenly", () => {
    expect(wheelFactor(-100, 0, false)).toBeGreaterThan(1);
    expect(wheelFactor(100, 0, false)).toBeLessThan(1);
    expect(wheelFactor(-100, 0, false) * wheelFactor(100, 0, false)).toBeCloseTo(1);
    expect(wheelFactor(0, 0, false)).toBe(1);
  });

  it("counts a line as 16 px and a page as 400 px, and a trackpad pinch (ctrl) more strongly", () => {
    expect(wheelFactor(3, 1, false)).toBeCloseTo(wheelFactor(48, 0, false));
    expect(wheelFactor(1, 2, false)).toBeCloseTo(wheelFactor(400, 0, false));
    expect(wheelFactor(10, 0, true)).toBeLessThan(wheelFactor(10, 0, false));
  });

  it("zooms at most by a fixed step for one turn, however large its delta", () => {
    expect(wheelFactor(-100000, 0, false)).toBe(wheelFactor(-400, 0, false));
  });
});
