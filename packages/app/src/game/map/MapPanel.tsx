// The Map area's contents (L2, #465): a Map/List toggle, then the drawn map or the List, which is MapView as it was
// before the drawn map. No hooks: ZoomableMap holds the mode, the List's zoom and the drawn map's refs, and passes
// them in, so tests render and walk this without a browser.
import type { CountryId, PublicState, RegionId } from "@terminal-dusk/engine";
import type { Ref } from "react";
import { MapView, shownZoom } from "../MapView.tsx";
import type { OnZoom, Zoom } from "../MapView.tsx";
import { DrawnMap } from "./DrawnMap.tsx";
import type { MapLayout } from "./layout.ts";
import { layoutFor } from "./layoutFor.ts";

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
  mode: MapMode;
  zoom: Zoom;
  on: PanelHandlers;
  /** The drawing for this map; layoutFor's when not given. */
  layout?: MapLayout | undefined;
  viewportRef?: Ref<HTMLDivElement> | undefined;
  wrapperRef?: Ref<HTMLDivElement> | undefined;
};

function Toggle({ mode, on }: Readonly<Pick<PanelProps, "mode" | "on">>) {
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
    </div>
  );
}

export function MapPanel({ pub, touched, mode, zoom, on, layout, viewportRef, wrapperRef }: Readonly<PanelProps>) {
  const { map } = pub;
  if (map === undefined) return <p>No map in this game</p>;
  return (
    <div className="dm" data-mode={mode}>
      <Toggle mode={mode} on={on} />
      {mode === "map" ? (
        <DrawnMap
          pub={pub}
          layout={layout ?? layoutFor(map)}
          touched={touched}
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
