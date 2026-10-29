// The drawn map's view (L2, #465): how far it is zoomed and moved, as one CSS transform on its one wrapper
// (docs/architecture.md, Decision 6). Pure maths only; mapControl.ts writes the result through a ref.
// A view maps a layout point p to the screen point p * scale + (x, y), with the transform origin at the top left.
import type { Point, Rect, Size } from "./layout.ts";

export type View = { scale: number; x: number; y: number };
/** The drawing's size and the screen area it is shown in. */
export type Bounds = { content: Size; viewport: Size };

/** How far past "the whole map fits" the map may zoom in. */
export const MAX_ZOOM = 4;
const IDENTITY: View = { scale: 1, x: 0, y: 0 };

/** The view that shows all of `rect` as large as it fits on a screen of `size`, centred. */
export function fitTransform(rect: Rect, size: Size): View {
  if (rect.w <= 0 || rect.h <= 0 || size.w <= 0 || size.h <= 0) return IDENTITY;
  const scale = Math.min(size.w / rect.w, size.h / rect.h);
  return {
    scale,
    x: (size.w - rect.w * scale) / 2 - rect.x * scale,
    y: (size.h - rect.h * scale) / 2 - rect.y * scale,
  };
}

/** A view as the CSS transform that draws it. */
export const transformCss = (view: View): string => `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;

/** The smallest zoom: the whole map fits on the screen. */
export const minScale = (bounds: Bounds): number =>
  fitTransform({ x: 0, y: 0, ...bounds.content }, bounds.viewport).scale;

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** One direction's move: a map larger than the screen always covers it; a smaller one stays wholly on it. */
function clampMove(move: number, drawn: number, screen: number): number {
  const room = screen - drawn;
  return clamp(move, Math.min(0, room), Math.max(0, room));
}

/** The view kept between the whole map fitting and MAX_ZOOM times that, and never dragged off the screen. */
export function clampView(view: View, bounds: Bounds): View {
  const low = minScale(bounds);
  const scale = clamp(view.scale, low, low * MAX_ZOOM);
  return {
    scale,
    x: clampMove(view.x, bounds.content.w * scale, bounds.viewport.w),
    y: clampMove(view.y, bounds.content.h * scale, bounds.viewport.h),
  };
}

/** Zoom by `factor` around the screen point `at`, which keeps the same layout point under it (within the clamps). */
export function zoomAt(view: View, factor: number, at: Point, bounds: Bounds): View {
  const low = minScale(bounds);
  const scale = clamp(view.scale * factor, low, low * MAX_ZOOM);
  const ratio = scale / view.scale;
  return clampView({ scale, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio }, bounds);
}

/** Move the map by a drag of (dx, dy) screen px, within the clamps. */
export const panBy = (view: View, dx: number, dy: number, bounds: Bounds): View =>
  clampView({ ...view, x: view.x + dx, y: view.y + dy }, bounds);

const distance = ([a, b]: readonly [Point, Point]): number => Math.hypot(b.x - a.x, b.y - a.y);

/** How much a pinch zooms: the two fingers' distance now over their distance before; 1 when they started together. */
export function pinchFactor(before: readonly [Point, Point], now: readonly [Point, Point]): number {
  const from = distance(before);
  return from === 0 ? 1 : distance(now) / from;
}

/** The point halfway between two fingers. */
export const midpoint = ([a, b]: readonly [Point, Point]): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
