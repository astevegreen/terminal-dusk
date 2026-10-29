// The Map area's one hook holder (docs/architecture.md, Decision 6). It keeps the Map/List mode and the List's zoom
// as local UI state, and, on the drawn map (L2, #465), the view in a ref: mapControl.ts moves the wrapper by a CSS
// transform written straight to its style on wheel, drag, pinch, a region's tap and "Whole map", outside React's
// renders. Both zooms stay across frames, so the rival's moves keep the same place on screen with the new numbers;
// a List zoom the new frame's map lacks draws the whole list (shownZoom).
import type { CountryId, GameEvent, PublicState } from "@terminal-dusk/engine";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { touchedCountries } from "../eventPresentation.ts";
import type { Zoom } from "./MapView.tsx";
import type { View } from "./map/fitTransform.ts";
import { layoutFor } from "./map/layoutFor.ts";
import { controlMap } from "./map/mapControl.ts";
import type { MapControl } from "./map/mapControl.ts";
import { MapPanel } from "./map/MapPanel.tsx";
import type { MapMode } from "./map/MapPanel.tsx";
import "./map/mapTheme.css";
import "./map/drawnMap.css";

const NO_EVENTS: readonly GameEvent[] = [];

type ZoomableMapProps = {
  pub: PublicState;
  /** The frame's events, whose countries the drawn map highlights. */
  events?: readonly GameEvent[];
  /** The view shown first: the drawn map unless a test asks for the List. */
  startMode?: MapMode;
};

function ZoomableMapInner({ pub, events = NO_EVENTS, startMode = "map" }: Readonly<ZoomableMapProps>) {
  const [mode, setMode] = useState<MapMode>(startMode);
  const [zoom, setZoom] = useState<Zoom>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const saved = useRef<View | null>(null);
  const control = useRef<MapControl | null>(null);
  const layout = useMemo(() => (pub.map === undefined ? undefined : layoutFor(pub.map)), [pub.map]);
  // The highlight: the countries this frame's events touched, until the next frame.
  const touched = useMemo(() => new Set<CountryId>(touchedCountries(events)), [events]);
  const w = layout?.size.w ?? 0;
  const h = layout?.size.h ?? 0;

  // Re-run only when the drawing's size changes or the drawn map is shown, so new frames keep the view.
  useLayoutEffect(() => {
    if (mode !== "map" || viewport.current === null || wrapper.current === null || w === 0) return;
    const made = controlMap(viewport.current, wrapper.current, { w, h }, saved);
    control.current = made;
    return () => {
      made.dispose();
      control.current = null;
    };
  }, [mode, w, h]);

  return (
    <MapPanel
      pub={pub}
      touched={touched}
      mode={mode}
      zoom={zoom}
      layout={layout}
      viewportRef={viewport}
      wrapperRef={wrapper}
      on={{
        mode: setMode,
        zoom: setZoom,
        region: (id) => {
          const rect = layout?.regions[id];
          if (rect !== undefined) control.current?.fit(rect);
        },
        whole: () => control.current?.whole(),
      }}
    />
  );
}

/**
 * Wrapped in `memo`, so it redraws only when the frame's public part or events change. A memo element is not a
 * plain function, so the test walkers that call function components directly (testMode/promptTree.ts,
 * online/test/screenTree.ts) step over it instead of calling its hooks; MapPanel's own tests cover the map.
 */
export const ZoomableMap = memo(ZoomableMapInner);
