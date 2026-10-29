// The drawn map's wiring to the browser (L2, #465), driven here with stand-in elements: the wheel zooms around the
// cursor without scrolling the page, a drag past 6 px moves the map and is not a tap, two fingers pinch, a region
// fits the screen, "Whole map" resets, and the view is written only as the wrapper's CSS transform.
import { describe, expect, it } from "vitest";
import { MAX_ZOOM, fitTransform, transformCss } from "./fitTransform.ts";
import type { View } from "./fitTransform.ts";
import { controlMap } from "./mapControl.ts";
import type { SavedView } from "./mapControl.ts";

type Listener = (event: FakeEvent) => void;
type FakeEvent = Record<string, unknown> & { prevented: boolean; stopped: boolean };

/** Just enough of an element for mapControl: listeners, a size, a place on the page, pointer capture, a style. */
class FakeElement {
  readonly listeners: { type: string; fn: Listener; options: unknown }[] = [];
  readonly style = { transform: "" };
  readonly captured = new Set<number>();
  clientWidth: number;
  clientHeight: number;
  constructor(clientWidth = 500, clientHeight = 400) {
    this.clientWidth = clientWidth;
    this.clientHeight = clientHeight;
  }
  addEventListener(type: string, fn: Listener, options?: unknown) {
    this.listeners.push({ type, fn, options });
  }
  removeEventListener(type: string, fn: Listener) {
    const at = this.listeners.findIndex((l) => l.type === type && l.fn === fn);
    if (at >= 0) this.listeners.splice(at, 1);
  }
  getBoundingClientRect() {
    return { left: 10, top: 20 };
  }
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  fire(type: string, init: Record<string, unknown> = {}): FakeEvent {
    const event: FakeEvent = {
      prevented: false,
      stopped: false,
      ...init,
      preventDefault() {
        event.prevented = true;
      },
      stopPropagation() {
        event.stopped = true;
      },
    };
    for (const l of this.listeners.filter((l) => l.type === type)) l.fn(event);
    return event;
  }
}

const content = { w: 1000, h: 560 };
const whole = (w = 500, h = 400): View => fitTransform({ x: 0, y: 0, ...content }, { w, h });
/** The view a transform string writes, read back. */
function viewOf(transform: string): View {
  const m = /^translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) scale\(([\d.e-]+)\)$/.exec(transform);
  if (!m) throw new Error(`not a map transform: ${transform}`);
  return { x: Number(m[1]), y: Number(m[2]), scale: Number(m[3]) };
}

function setUp(saved: SavedView = { current: null }, size?: [number, number]) {
  const viewport = new FakeElement(...(size ?? []));
  const wrapper = new FakeElement();
  const control = controlMap(viewport as unknown as HTMLElement, wrapper as unknown as HTMLElement, content, saved);
  /** A pointer event at a point inside the viewport (the page is offset by 10, 20). */
  const pointer = (type: string, id: number, x: number, y: number, extra: Record<string, unknown> = {}) =>
    viewport.fire(type, { pointerId: id, clientX: x + 10, clientY: y + 20, pointerType: "touch", button: 0, ...extra });
  return { viewport, wrapper, control, saved, pointer, view: () => viewOf(wrapper.style.transform) };
}

describe("starting", () => {
  it("shows the whole map, written as the wrapper's transform and kept in the saved view", () => {
    const { wrapper, saved } = setUp();
    expect(wrapper.style.transform).toBe(transformCss(whole()));
    expect(saved.current).toEqual(whole());
  });

  it("keeps a saved view (the List toggle and back), within the clamps", () => {
    const { view } = setUp({ current: { scale: 1, x: -100, y: -50 } });
    expect(view()).toEqual({ scale: 1, x: -100, y: -50 });
    expect(setUp({ current: { scale: 50, x: 0, y: 0 } }).view().scale).toBe(whole().scale * MAX_ZOOM);
  });

  it("writes nothing while the map area has no size, and fits the whole map once it has one", () => {
    const { viewport, wrapper, control } = setUp({ current: null }, [0, 0]);
    expect(wrapper.style.transform).toBe("");
    viewport.clientWidth = 500;
    viewport.clientHeight = 400;
    control.resize();
    expect(wrapper.style.transform).toBe(transformCss(whole()));
  });
});

describe("the wheel", () => {
  it("is listened to on the map area as not passive, and never scrolls or zooms the page", () => {
    const { viewport } = setUp();
    expect(viewport.listeners.find((l) => l.type === "wheel")?.options).toEqual({ passive: false });
    expect(viewport.fire("wheel", { deltaY: -100, deltaMode: 0, clientX: 110, clientY: 120 }).prevented).toBe(true);
  });

  it("zooms in around the cursor: the point under it stays under it", () => {
    const { viewport, view } = setUp();
    const before = view();
    const cursor = { x: 100, y: 100 };
    const under = { x: (cursor.x - before.x) / before.scale, y: (cursor.y - before.y) / before.scale };
    viewport.fire("wheel", { deltaY: -100, deltaMode: 0, clientX: cursor.x + 10, clientY: cursor.y + 20 });
    const after = view();
    expect(after.scale).toBeGreaterThan(before.scale);
    expect(under.x * after.scale + after.x).toBeCloseTo(cursor.x);
    expect(under.y * after.scale + after.y).toBeCloseTo(cursor.y);
  });

  it("zooming out stops at the whole map", () => {
    const { viewport, view } = setUp();
    for (let i = 0; i < 20; i++) viewport.fire("wheel", { deltaY: 400, deltaMode: 0, clientX: 50, clientY: 50 });
    expect(view()).toEqual(whole());
  });
});

describe("dragging", () => {
  const zoomedIn = { current: { scale: 1, x: -200, y: -100 } };

  it("a move under 6 px is still a tap: the map stays, and the click that follows reaches the button", () => {
    const { pointer, view, viewport } = setUp({ current: { ...zoomedIn.current } });
    pointer("pointerdown", 1, 100, 100);
    pointer("pointermove", 1, 104, 103);
    pointer("pointerup", 1, 104, 103);
    expect(view()).toEqual(zoomedIn.current);
    expect(viewport.captured.size).toBe(0);
    const click = viewport.fire("click", { detail: 1 });
    expect(click.stopped).toBe(false);
  });

  it("a drag moves the map, takes the pointer, and its click is swallowed so it is not a tap", () => {
    const { pointer, view, viewport } = setUp({ current: { ...zoomedIn.current } });
    pointer("pointerdown", 1, 100, 100, { pointerType: "mouse" });
    pointer("pointermove", 1, 130, 90, { pointerType: "mouse" });
    pointer("pointerup", 1, 130, 90, { pointerType: "mouse" });
    expect(view()).toEqual({ scale: 1, x: -170, y: -110 });
    expect(viewport.captured.has(1)).toBe(true);
    const click = viewport.fire("click", { detail: 1 });
    expect(click.stopped && click.prevented).toBe(true);
    // A click from the keyboard afterwards (detail 0) is never swallowed.
    expect(viewport.fire("click", { detail: 0 }).stopped).toBe(false);
  });

  it("still drags when the browser refuses to capture the pointer", () => {
    const { pointer, view, viewport } = setUp({ current: { ...zoomedIn.current } });
    viewport.setPointerCapture = () => {
      throw new Error("NotFoundError");
    };
    pointer("pointerdown", 1, 100, 100);
    pointer("pointermove", 1, 120, 100);
    expect(view()).toEqual({ scale: 1, x: -180, y: -100 });
  });

  it("ignores the mouse's other buttons", () => {
    const { pointer, view } = setUp({ current: { ...zoomedIn.current } });
    pointer("pointerdown", 1, 100, 100, { pointerType: "mouse", button: 2 });
    pointer("pointermove", 1, 160, 160, { pointerType: "mouse", button: 2 });
    expect(view()).toEqual(zoomedIn.current);
  });

  it("a cancelled pointer stops dragging", () => {
    const { pointer, view } = setUp({ current: { ...zoomedIn.current } });
    pointer("pointerdown", 1, 100, 100);
    pointer("pointercancel", 1, 100, 100);
    pointer("pointermove", 1, 160, 160);
    expect(view()).toEqual(zoomedIn.current);
  });
});

describe("pinching", () => {
  it("two fingers spread twice as far apart double the zoom", () => {
    const { pointer, view } = setUp();
    pointer("pointerdown", 1, 200, 200);
    pointer("pointerdown", 2, 300, 200);
    pointer("pointermove", 2, 400, 200);
    expect(view().scale).toBeCloseTo(whole().scale * 2);
  });
});

describe("fit and whole", () => {
  it("fit shows a region as large as fits, all on screen; whole goes back to the whole map", () => {
    const { control, view } = setUp();
    const region = { x: 236, y: 8, w: 348, h: 196 };
    control.fit(region);
    const fitted = view();
    expect(fitted.scale).toBeCloseTo(fitTransform(region, { w: 500, h: 400 }).scale);
    // Centring would leave a gap above the map's top edge, so the clamps keep the map's edge at the screen's.
    expect(fitted.y).toBe(0);
    for (const [x, y] of [
      [region.x, region.y],
      [region.x + region.w, region.y + region.h],
    ] as const) {
      expect(x * fitted.scale + fitted.x).toBeGreaterThanOrEqual(-0.001);
      expect(x * fitted.scale + fitted.x).toBeLessThanOrEqual(500.001);
      expect(y * fitted.scale + fitted.y).toBeGreaterThanOrEqual(0);
      expect(y * fitted.scale + fitted.y).toBeLessThanOrEqual(400);
    }
    control.whole();
    expect(view()).toEqual(whole());
  });
});

describe("a resized map area", () => {
  it("still shows the whole map if it did, and keeps a zoomed view within the clamps", () => {
    const { viewport, control, view } = setUp();
    viewport.clientWidth = 800;
    viewport.clientHeight = 300;
    control.resize();
    expect(view()).toEqual(whole(800, 300));
    control.fit({ x: 0, y: 0, w: 200, h: 100 });
    viewport.clientWidth = 400;
    control.resize();
    const after = view();
    expect(after.x).toBeLessThanOrEqual(0);
    expect(after.scale).toBeLessThanOrEqual(whole(400, 300).scale * MAX_ZOOM);
  });
});

describe("picking a country (L7, #487)", () => {
  const zoomedIn = { current: { scale: 1, x: -200, y: -100 } };

  it("the click that ends a drag starting on a glowing country is swallowed in the capture phase, so it never answers", () => {
    const { pointer, viewport } = setUp({ current: { ...zoomedIn.current } });
    // The guard listens in the capture phase, so it runs before the marker's own button hears the click.
    expect(viewport.listeners.find((l) => l.type === "click")?.options).toEqual({ capture: true });
    pointer("pointerdown", 1, 100, 100);
    pointer("pointermove", 1, 100, 140);
    pointer("pointerup", 1, 100, 140);
    expect(viewport.fire("click", { detail: 1 }).stopped).toBe(true);
    // The next tap is a tap again.
    pointer("pointerdown", 2, 100, 100);
    pointer("pointerup", 2, 100, 100);
    expect(viewport.fire("click", { detail: 1 }).stopped).toBe(false);
  });

  it("the click that ends a pinch is swallowed too", () => {
    const { pointer, viewport } = setUp();
    pointer("pointerdown", 1, 200, 200);
    pointer("pointerdown", 2, 300, 200);
    pointer("pointermove", 2, 400, 200);
    pointer("pointerup", 2, 400, 200);
    pointer("pointerup", 1, 200, 200);
    expect(viewport.fire("click", { detail: 1 }).stopped).toBe(true);
  });

  it("scale says how large the map is drawn; focus zooms until a marker is drawn at the pick scale, within the clamps", () => {
    const { control, view } = setUp();
    expect(control.scale()).toBeCloseTo(whole().scale);
    const region = { x: 0, y: 0, w: 1000, h: 560 };
    expect(control.focus(region, { x: 500, y: 280 }, 1.5)).toBe(true);
    expect(view().scale).toBeCloseTo(1.5);
    expect(control.scale()).toBeCloseTo(1.5);
    // Centred on the country: (500, 280) is drawn in the middle of the 500 x 400 map area.
    expect(500 * view().scale + view().x).toBeCloseTo(250);
    expect(280 * view().scale + view().y).toBeCloseTo(200);
    // Already there: nothing to zoom to, so the caller answers instead.
    expect(control.focus(region, { x: 500, y: 280 }, 1.5)).toBe(false);
    // Never past the largest zoom.
    control.focus(region, { x: 500, y: 280 }, 100);
    expect(view().scale).toBeCloseTo(whole().scale * MAX_ZOOM);
  });

  it("reveal moves the map without zooming, just enough to show a marker off the screen", () => {
    const { control, view } = setUp({ current: { scale: 1, x: 0, y: 0 } });
    control.reveal({ x: 900, y: 100, w: 92, h: 48 });
    expect(view().scale).toBe(1);
    // The marker's right edge, 8 px in from the screen's.
    expect(view().x).toBe(500 - 8 - 992);
    expect(view().y).toBe(0);
    const before = view();
    control.reveal({ x: 600, y: 100, w: 92, h: 48 });
    expect(view()).toEqual(before);
  });
});

describe("dispose", () => {
  it("removes every listener it added", () => {
    const { viewport, control } = setUp();
    expect(viewport.listeners.length).toBeGreaterThan(0);
    control.dispose();
    expect(viewport.listeners).toEqual([]);
  });
});
