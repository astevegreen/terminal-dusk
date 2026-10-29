// The Map area's contents (L2, #465): a Map/List toggle (with the picture's credit on a real-geography map, L3,
// #479), then the drawn map or the List, which is MapView as it was
// before the drawn map. No hooks: ZoomableMap holds the mode, the List's zoom and the drawn map's refs, and passes
// them in, so tests render and walk this without a browser.
import type { CountryId, PublicState, RegionId } from "@terminal-dusk/engine";
import type { Ref } from "react";
import { MapView, shownZoom } from "../MapView.tsx";
import type { OnZoom, Zoom } from "../MapView.tsx";
import { DrawnMap } from "./DrawnMap.tsx";
import type { MapLayout } from "./layout.ts";
import { layoutFor } from "./layoutFor.ts";
import type { Beat } from "./pulse.ts";

export type MapMode = "map" | "list";

export type PanelHandlers = {
  /** Show the drawn map or the List. */
  mode: (mode: MapMode) => void;
  /** The List's zoom, as MapView asks for it. */
  zoom: OnZoom;
  /** Fit a region of the drawn map to the screen. */
  region: (region: RegionId) => void;
  /** Show the whole drawn map. */
  whole: () => void;
};

export type PanelProps = {
  pub: PublicState;
  touched: ReadonlySet<CountryId>;
  /** The pulse's beat for the touched countries (pulse.ts); 0 when not given. */
  beat?: Beat | undefined;
  mode: MapMode;
  zoom: Zoom;
  on: PanelHandlers;
  /** The drawing for this map; layoutFor's when not given. */
  layout?: MapLayout | undefined;
  viewportRef?: Ref<HTMLDivElement> | undefined;
  wrapperRef?: Ref<HTMLDivElement> | undefined;
};

function Toggle({ mode, on, credit }: Readonly<Pick<PanelProps, "mode" | "on"> & { credit: string | undefined }>) {
  return (
    <div className="dm-tools" role="toolbar" aria-label="Map view">
      <button type="button" aria-pressed={mode === "map"} onClick={() => on.mode("map")}>
        Map
      </button>
      <button type="button" aria-pressed={mode === "list"} onClick={() => on.mode("list")}>
        List
      </button>
      {mode === "map" && (
        <button type="button" onClick={() => on.whole()}>
          Whole map
        </button>
      )}
      {mode === "map" && credit !== undefined && <span className="dm-credit">{credit}</span>}
    </div>
  );
}

export function MapPanel({
  pub,
  touched,
  beat,
  mode,
  zoom,
  on,
  layout,
  viewportRef,
  wrapperRef,
}: Readonly<PanelProps>) {
  const { map } = pub;
  if (map === undefined) return <p>No map in this game</p>;
  const drawing = layout ?? layoutFor(map);
  return (
    <div className="dm" data-mode={mode}>
      <Toggle mode={mode} on={on} credit={drawing.art?.credit} />
      {mode === "map" ? (
        <DrawnMap
          pub={pub}
          layout={drawing}
          touched={touched}
          beat={beat}
          onRegion={on.region}
          viewportRef={viewportRef}
          wrapperRef={wrapperRef}
        />
      ) : (
        <MapView pub={pub} zoom={shownZoom(map, zoom)} onZoom={on.zoom} />
      )}
    </div>
  );
}
