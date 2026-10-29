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

/** The view at `scale` with the layout point `centre` in the middle of a screen of `size`. */
const centredOn = (centre: Point, scale: number, size: Size): View => ({
  scale,
  x: size.w / 2 - centre.x * scale,
  y: size.h / 2 - centre.y * scale,
});

/**
 * The view a tap on a glowing country that is still too small to pick zooms to (L7, #487): its region fitted to
 * the screen, or, when that draws its markers smaller than `pickScale`, the zoom raised to `pickScale` and centred
 * on the country. Never past `maxScale` (the largest zoom), keeping the same centre. The caller still clamps it to
 * the map's bounds, which may move it but no longer zooms it.
 */
export function focusTransform(region: Rect, country: Point, size: Size, pickScale: number, maxScale = Infinity): View {
  const fit = fitTransform(region, size);
  if (size.w <= 0 || size.h <= 0) return fit;
  if (fit.scale < pickScale) return centredOn(country, Math.min(pickScale, maxScale), size);
  if (fit.scale <= maxScale) return fit;
  return centredOn({ x: region.x + region.w / 2, y: region.y + region.h / 2 }, maxScale, size);
}

/** One direction's move that brings [low, high] inside [margin, screen - margin], or no move when it is already. */
function bringInside(low: number, high: number, screen: number, margin: number): number {
  if (low < margin) return margin - low;
  if (high > screen - margin) return Math.max(screen - margin - high, margin - low);
  return 0;
}

/**
 * The view moved, never zoomed, just enough to show `rect` (a marker, in layout units) with `margin` screen px
 * around it, within the clamps: where the keyboard's focus goes, the map follows (L7, #487).
 */
export function revealView(view: View, rect: Rect, bounds: Bounds, margin = 8): View {
  const left = rect.x * view.scale + view.x;
  const top = rect.y * view.scale + view.y;
  const dx = bringInside(left, left + rect.w * view.scale, bounds.viewport.w, margin);
  const dy = bringInside(top, top + rect.h * view.scale, bounds.viewport.h, margin);
  return dx === 0 && dy === 0 ? view : panBy(view, dx, dy, bounds);
}

const distance = ([a, b]: readonly [Point, Point]): number => Math.hypot(b.x - a.x, b.y - a.y);

/** How much a pinch zooms: the two fingers' distance now over their distance before; 1 when they started together. */
export function pinchFactor(before: readonly [Point, Point], now: readonly [Point, Point]): number {
  const from = distance(before);
  return from === 0 ? 1 : distance(now) / from;
}

/** The point halfway between two fingers. */
export const midpoint = ([a, b]: readonly [Point, Point]): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
