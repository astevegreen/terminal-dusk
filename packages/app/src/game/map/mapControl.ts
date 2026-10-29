// The drawn map's wiring to the browser (L2, #465; docs/architecture.md, Decision 6): wheel, pointer and resize
// events on the map area move one wrapper by a CSS transform written straight to its style, never through a
// React render. The maths is in fitTransform.ts and gestures.ts; this file only listens and writes.
import { clampView, fitTransform, transformCss, zoomAt } from "./fitTransform.ts";
import type { Bounds, View } from "./fitTransform.ts";
import { NO_GESTURE, pointerDown, pointerMove, pointerUp, wheelFactor } from "./gestures.ts";
import type { Point, Rect, Size } from "./layout.ts";

/** The view, kept by ZoomableMap in a ref, so it lasts while the map is redrawn or the List is shown. */
export type SavedView = { current: View | null };

export type MapControl = {
  /** Shows `rect` (a region) as large as fits, centred. */
  fit: (rect: Rect) => void;
  /** Shows the whole map. */
  whole: () => void;
  /** Fits the view to the map area's new size: still the whole map if it was, otherwise within the clamps. */
  resize: () => void;
  dispose: () => void;
};

const sameView = (a: View, b: View): boolean => a.scale === b.scale && a.x === b.x && a.y === b.y;
const NOT_PASSIVE: AddEventListenerOptions = { passive: false };
const CAPTURE: AddEventListenerOptions = { capture: true };

/** Starts listening on `viewport` (the map area) and moving `wrapper` (the drawing of size `content`) inside it. */
export function controlMap(viewport: HTMLElement, wrapper: HTMLElement, content: Size, saved: SavedView): MapControl {
  let gesture = NO_GESTURE;
  let shownOn: Size = { w: 0, h: 0 };

  const screen = (): Size => ({ w: viewport.clientWidth, h: viewport.clientHeight });
  const bounds = (): Bounds => ({ content, viewport: screen() });
  const wholeOn = (size: Size): View => fitTransform({ x: 0, y: 0, ...content }, size);
  const hasSize = (size: Size): boolean => size.w > 0 && size.h > 0;
  const show = (view: View): void => {
    saved.current = view;
    shownOn = screen();
    wrapper.style.transform = transformCss(view);
  };
  const at = (event: { clientX: number; clientY: number }): Point => {
    const box = viewport.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  /** Keeps a drag's moves coming here even off the map; a pointer already gone (or a made-up one) is let be. */
  const capture = (id: number): void => {
    try {
      viewport.setPointerCapture(id);
    } catch {
      // Nothing to capture: the drag still moves the map while the pointer stays over it.
    }
  };

  const resize = (): void => {
    const now = screen();
    if (!hasSize(now)) return;
    const was = saved.current;
    const wasWhole = was === null || !hasSize(shownOn) || sameView(was, wholeOn(shownOn));
    show(wasWhole ? wholeOn(now) : clampView(was, bounds()));
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (saved.current === null) return;
    show(zoomAt(saved.current, wheelFactor(event.deltaY, event.deltaMode, event.ctrlKey), at(event), bounds()));
  };
  const onDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gesture = pointerDown(gesture, event.pointerId, at(event));
  };
  const onMove = (event: PointerEvent): void => {
    if (saved.current === null) return;
    const next = pointerMove(gesture, event.pointerId, at(event), saved.current, bounds());
    gesture = next.gesture;
    if (!gesture.dragging) return;
    // Taken only once it is a drag, so a tap's click still reaches the region button under it.
    if (!viewport.hasPointerCapture(event.pointerId)) capture(event.pointerId);
    if (!sameView(next.view, saved.current)) show(next.view);
  };
  const onUp = (event: PointerEvent): void => {
    gesture = pointerUp(gesture, event.pointerId);
  };
  /** The click that ends a drag or pinch is not a tap. A keyboard's click (detail 0) always goes through. */
  const onClick = (event: MouseEvent): void => {
    if (gesture.dragging && gesture.pointers.length === 0 && event.detail > 0) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (gesture.pointers.length === 0) gesture = NO_GESTURE;
  };

  const listeners: [string, (event: never) => void, AddEventListenerOptions | undefined][] = [
    ["wheel", onWheel, NOT_PASSIVE],
    ["pointerdown", onDown, undefined],
    ["pointermove", onMove, undefined],
    ["pointerup", onUp, undefined],
    ["pointercancel", onUp, undefined],
    ["click", onClick, CAPTURE],
  ];
  for (const [type, fn, options] of listeners) viewport.addEventListener(type, fn as EventListener, options);
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  observer?.observe(viewport);

  const start = screen();
  if (hasSize(start)) show(saved.current === null ? wholeOn(start) : clampView(saved.current, bounds()));

  return {
    fit: (rect) => {
      if (hasSize(screen())) show(clampView(fitTransform(rect, screen()), bounds()));
    },
    whole: () => {
      if (hasSize(screen())) show(wholeOn(screen()));
    },
    resize,
    dispose: () => {
      for (const [type, fn, options] of listeners) viewport.removeEventListener(type, fn as EventListener, options);
      observer?.disconnect();
    },
  };
}
