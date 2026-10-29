// The drawn map's gestures (L2, #465) as pure steps, so they are tested without a browser; mapControl.ts feeds
// them the real pointer and wheel events. One pointer is a tap until it moves DRAG_THRESHOLD px, then it drags the
// map. A second finger makes a pinch, which zooms around the fingers' midpoint and moves with it.
import { midpoint, panBy, pinchFactor, zoomAt } from "./fitTransform.ts";
import type { Bounds, View } from "./fitTransform.ts";
import type { Point } from "./layout.ts";

/** How far, in screen px, a pointer moves before it drags the map instead of tapping. */
export const DRAG_THRESHOLD = 6;

export type Gesture = {
  /** The pointers on the map, at most two, in the order they went down, each where it was last used. */
  readonly pointers: readonly { readonly id: number; readonly at: Point }[];
  /** True once the pointers dragged or pinched; the click that ends it is then not a tap. */
  readonly dragging: boolean;
};

export const NO_GESTURE: Gesture = { pointers: [], dragging: false };

/** A pointer goes down. The first starts a possible tap; the second a pinch; any more are not tracked. */
export function pointerDown(gesture: Gesture, id: number, at: Point): Gesture {
  if (gesture.pointers.length === 0) return { pointers: [{ id, at }], dragging: false };
  if (gesture.pointers.length >= 2 || gesture.pointers.some((p) => p.id === id)) return gesture;
  return { pointers: [...gesture.pointers, { id, at }], dragging: true };
}

/** A pointer comes up or is cancelled. `dragging` stays, for the click that follows. */
export function pointerUp(gesture: Gesture, id: number): Gesture {
  return { ...gesture, pointers: gesture.pointers.filter((p) => p.id !== id) };
}

const moved = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/** A tracked pointer moves to `at`: nothing yet while a lone pointer stays within the threshold. */
export function pointerMove(
  gesture: Gesture,
  id: number,
  at: Point,
  view: View,
  bounds: Bounds,
): { gesture: Gesture; view: View } {
  const index = gesture.pointers.findIndex((p) => p.id === id);
  const last = gesture.pointers[index];
  if (last === undefined) return { gesture, view };
  const pointers = gesture.pointers.map((p) => (p.id === id ? { id, at } : p));
  const [a, b] = gesture.pointers;
  if (a !== undefined && b !== undefined) {
    const before = [a.at, b.at] as const;
    const now = [pointers[0]!.at, pointers[1]!.at] as const;
    const from = midpoint(before);
    const to = midpoint(now);
    const zoomed = zoomAt(view, pinchFactor(before, now), from, bounds);
    return { gesture: { pointers, dragging: true }, view: panBy(zoomed, to.x - from.x, to.y - from.y, bounds) };
  }
  if (!gesture.dragging && moved(last.at, at) < DRAG_THRESHOLD) return { gesture, view };
  return { gesture: { pointers, dragging: true }, view: panBy(view, at.x - last.at.x, at.y - last.at.y, bounds) };
}

/** Screen px per wheel delta unit, by WheelEvent.deltaMode: px, lines, pages. */
const UNIT_PX: readonly number[] = [1, 16, 400];
/** How strongly a px of wheel zooms; a trackpad pinch (the browser's ctrl+wheel) sends small deltas. */
const WHEEL_ZOOM = 0.002;
const PINCH_ZOOM = 0.01;
/** The largest delta one wheel event counts, so one turn never jumps from whole map to full zoom. */
const MAX_DELTA = 400;

/** How much one wheel event zooms: above 1 (in) for a negative delta, its inverse for the same delta positive. */
export function wheelFactor(deltaY: number, deltaMode: number, ctrlKey: boolean): number {
  const px = deltaY * (UNIT_PX[deltaMode] ?? 1);
  const counted = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, px)) * (ctrlKey ? PINCH_ZOOM / WHEEL_ZOOM : 1);
  return counted === 0 ? 1 : Math.exp(-counted * WHEEL_ZOOM);
}
