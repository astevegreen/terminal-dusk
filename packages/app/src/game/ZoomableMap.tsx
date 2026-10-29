// The Map area's one hook holder (docs/architecture.md, Decision 6). It keeps the Map/List mode and the List's zoom
// as local UI state, and, on the drawn map (L2, #465), the view in a ref: mapControl.ts moves the wrapper by a CSS
// transform written straight to its style on wheel, drag, pinch, a region's tap and "Whole map", outside React's
// renders. Both zooms stay across frames, so the rival's moves keep the same place on screen with the new numbers;
// a List zoom the new frame's map lacks draws the whole list (shownZoom).
// Picking a country (L7, #487): a tap on a glowing country answers only once its marker is drawn at least 44 px
// tall (PICK_SCALE); before that, the tap zooms in on it. A click from the keyboard or a screen reader always answers.
import type { AnswerValue, CountryId, GameEvent, PublicState } from "@terminal-dusk/engine";
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import { picksByCountry } from "../countryChoices.ts";
import { touchedCountries } from "../eventPresentation.ts";
import type { Choice } from "../promptChoices.tsx";
import type { Zoom } from "./MapView.tsx";
import type { View } from "./map/fitTransform.ts";
import { PICK_SCALE, markerBox } from "./map/layout.ts";
import type { MapLayout } from "./map/layout.ts";
import { layoutFor } from "./map/layoutFor.ts";
import { controlMap } from "./map/mapControl.ts";
import type { MapControl } from "./map/mapControl.ts";
import type { MapPicks } from "./map/mapPicks.ts";
import { MapPanel } from "./map/MapPanel.tsx";
import type { MapMode } from "./map/MapPanel.tsx";
import type { PickHandlers } from "./map/Marker.tsx";
import { nextPulse } from "./map/pulse.ts";
import type { Pulse } from "./map/pulse.ts";
import "./map/mapTheme.css";
import "./map/drawnMap.css";

const NO_EVENTS: readonly GameEvent[] = [];
const NO_CHOICES: readonly Choice[] = [];
/** A hair under PICK_SCALE still counts, so a zoom that lands on it after rounding picks. */
const PICK_SLACK = 1e-6;

type ZoomableMapProps = {
  pub: PublicState;
  /** The frame's events, whose countries the drawn map highlights. */
  events?: readonly GameEvent[];
  /** The view shown first: the drawn map unless a test asks for the List. */
  startMode?: MapMode;
  /** The waiting decision's country choices (countryChoices.ts), which glow on the map; none when not answerable. */
  choices?: readonly Choice[];
  /** Sends a picked country's answer; left out, nothing can be picked. */
  onAnswer?: ((value: AnswerValue) => void) | undefined;
};

/** Where the country is on the drawing, and its region's rectangle, for zooming in on it. */
function placeOf(layout: MapLayout | undefined, pub: PublicState, country: CountryId) {
  const region = pub.map?.countries.find((c) => c.id === country)?.region;
  const rect = region === undefined ? undefined : layout?.regions[region];
  const at = layout?.countries[country];
  return rect === undefined || at === undefined ? undefined : { rect, at };
}

function ZoomableMapInner({
  pub,
  events = NO_EVENTS,
  startMode = "map",
  choices = NO_CHOICES,
  onAnswer,
}: Readonly<ZoomableMapProps>) {
  const [mode, setMode] = useState<MapMode>(startMode);
  const [zoom, setZoom] = useState<Zoom>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const saved = useRef<View | null>(null);
  const control = useRef<MapControl | null>(null);
  const layout = useMemo(() => (pub.map === undefined ? undefined : layoutFor(pub.map)), [pub.map]);
  // The highlight: the countries this frame's events touched, until the next frame. Each new batch of events flips
  // the pulse's beat, so they pulse again even when the last batch touched them too (pulse.ts; L9, #489).
  const touched = useMemo(() => new Set<CountryId>(touchedCountries(events)), [events]);
  const [pulse, setPulse] = useState<Pulse>({ events, beat: 0 });
  const next = nextPulse(pulse, events);
  if (next !== pulse) setPulse(next);
  const byCountry = useMemo(() => picksByCountry(choices), [choices]);
  // The latest of what the handlers read, so the handlers stay the same object and the markers' memo holds.
  const latest = useRef({ byCountry, onAnswer, layout, pub });
  latest.current = { byCountry, onAnswer, layout, pub };
  const on = useMemo<PickHandlers>(
    () => ({
      pick: (country, keyboard) => {
        const now = latest.current;
        const choice = now.byCountry.get(country);
        if (choice === undefined || now.onAnswer === undefined) return;
        const ctl = control.current;
        const big = ctl === null || ctl.scale() >= PICK_SCALE - PICK_SLACK;
        const place = placeOf(now.layout, now.pub, country);
        // Too small to tap: zoom in on it instead, unless there is no more zoom to give.
        if (!keyboard && !big && ctl !== null && place !== undefined && ctl.focus(place.rect, place.at, PICK_SCALE))
          return;
        now.onAnswer(choice.value);
      },
      reveal: (country) => {
        const at = latest.current.layout?.countries[country];
        if (at !== undefined) control.current?.reveal(markerBox(at));
      },
    }),
    [],
  );
  const picks = useMemo<MapPicks | undefined>(
    () =>
      onAnswer === undefined || byCountry.size === 0
        ? undefined
        : { choices: byCountry, on, answer: (choice) => onAnswer(choice.value) },
    [byCountry, on, onAnswer],
  );
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
      beat={next.beat}
      mode={mode}
      zoom={zoom}
      layout={layout}
      picks={picks}
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
 * Wrapped in `memo`, so it redraws only when the frame's public part, events or choices change. A memo element is
 * not a plain function, so the test walkers that call function components directly (testMode/promptTree.ts,
 * online/test/screenTree.ts) step over it instead of calling its hooks; MapPanel's own tests cover the map.
 */
export const ZoomableMap = memo(ZoomableMapInner);
