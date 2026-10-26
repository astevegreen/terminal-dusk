// Holds the map's zoom as local UI state (docs/architecture.md, Decision 6) and draws MapView with it. This is
// the only part of the map with a hook. The zoom stays across frames, so the rival's moves keep the same region
// on screen with the new numbers; a zoom the new frame's map lacks draws the whole map (shownZoom).
import type { PublicState } from "@terminal-dusk/engine";
import { memo, useState } from "react";
import { MapView, shownZoom } from "./MapView.tsx";
import type { Zoom } from "./MapView.tsx";

function ZoomableMapInner({ pub }: Readonly<{ pub: PublicState }>) {
  const [zoom, setZoom] = useState<Zoom>(null);
  return <MapView pub={pub} zoom={shownZoom(pub.map, zoom)} onZoom={setZoom} />;
}

/**
 * Wrapped in `memo`, so it redraws only when the frame's public part changes. A memo element is not a plain
 * function, so the test walkers that call function components directly (testMode/promptTree.ts,
 * online/test/screenTree.ts) step over it instead of calling its hook; MapView's own tests cover the map.
 */
export const ZoomableMap = memo(ZoomableMapInner);
