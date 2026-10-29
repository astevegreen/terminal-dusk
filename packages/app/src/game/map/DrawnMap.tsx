// The drawn map (L2, #465): one wrapper the size of the layout, which mapControl.ts moves by a CSS transform.
// Inside it, a picture (hidden from readers) shades each region, greyed when closed, and draws the lines between
// neighbours and from each home box to its countries; a button over each region zooms to it; and the markers sit
// on top. It reads only the frame's public part, through the engine's pure helpers (the closed regions and the
// battlegrounds by way of the host, as the app's boundary allows). No hooks: ZoomableMap holds the refs and the
// zoom, so tests can render and walk it without a browser.
import { SIDES, controller } from "@terminal-dusk/engine";
import type { CountryId, PublicState, RegionId } from "@terminal-dusk/engine";
import { closedRegions, isBattleground } from "@terminal-dusk/host/first-deck";
import type { Ref } from "react";
import { SIDE_NAME } from "../../displayText.ts";
import { influenceOf } from "../MapView.tsx";
import { neighbourPairs, shortName } from "./layout.ts";
import type { MapLayout, Point } from "./layout.ts";
import { Marker, placeOf } from "./Marker.tsx";

export type DrawnMapProps = {
  pub: PublicState;
  layout: MapLayout;
  touched: ReadonlySet<CountryId>;
  onRegion: (region: RegionId) => void;
  viewportRef?: Ref<HTMLDivElement> | undefined;
  wrapperRef?: Ref<HTMLDivElement> | undefined;
};

/** How many flat region shades drawnMap.css has; regions take them in the map's order. */
const TONES = 6;

function Line({ className, from, to, home }: Readonly<{ className: string; from: Point; to: Point; home?: string }>) {
  return <line className={className} data-home={home} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
}

/** The picture under the markers: region areas, then the neighbour lines, then the home-box lines. */
function Picture({ pub, layout }: Readonly<{ pub: PublicState; layout: MapLayout }>) {
  const map = pub.map!;
  const { w, h } = layout.size;
  return (
    <svg className="dm-lines" aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {map.regions.map((region, i) => {
        const r = layout.regions[region.id]!;
        const closed = closedRegions(pub).includes(region.id);
        return (
          <rect
            key={region.id}
            className="dm-area"
            data-region={region.id}
            data-closed={closed ? "true" : undefined}
            data-tone={i % TONES}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={8}
          />
        );
      })}
      {neighbourPairs(map).map(([a, b]) => (
        <Line key={`${a}|${b}`} className="dm-link" from={layout.countries[a]!} to={layout.countries[b]!} />
      ))}
      {SIDES.flatMap((side) =>
        map.homeBox[side].map((c) => (
          <Line
            key={`${side}|${c}`}
            className="dm-home-link"
            home={side}
            from={layout.homes[side]}
            to={layout.countries[c]!}
          />
        )),
      )}
    </svg>
  );
}

/** A button over each region's area, named after the region, which zooms to it. */
function RegionButtons({ pub, layout, onRegion }: Readonly<Pick<DrawnMapProps, "pub" | "layout" | "onRegion">>) {
  return pub.map!.regions.map((region) => {
    const r = layout.regions[region.id]!;
    const closed = closedRegions(pub).includes(region.id);
    return (
      <button
        key={region.id}
        type="button"
        className="dm-region"
        data-region={region.id}
        data-closed={closed ? "true" : undefined}
        style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
        onClick={() => onRegion(region.id)}
      >
        {closed ? `${region.name} (closed)` : region.name}
      </button>
    );
  });
}

/** The map in its wrapper, inside the map area that clips it; a frame with no map draws nothing here. */
export function DrawnMap({ pub, layout, touched, onRegion, viewportRef, wrapperRef }: Readonly<DrawnMapProps>) {
  const { map } = pub;
  if (map === undefined) return null;
  return (
    <div className="dm-view" ref={viewportRef}>
      <div className="dm-world" style={{ width: layout.size.w, height: layout.size.h }} ref={wrapperRef}>
        <Picture pub={pub} layout={layout} />
        <RegionButtons pub={pub} layout={layout} onRegion={onRegion} />
        <ul className="dm-homes" aria-label="Home boxes">
          {SIDES.map((side) => (
            <li key={side} className="dm-home" data-home={side} style={placeOf(layout.homes[side])}>
              {`${SIDE_NAME[side]} home`}
            </li>
          ))}
        </ul>
        <ul className="dm-markers" aria-label="Countries">
          {map.countries.map((c) => {
            const at = layout.countries[c.id]!;
            const { lio, sae } = influenceOf(pub.influence, c);
            return (
              <Marker
                key={c.id}
                id={c.id}
                name={c.name}
                short={layout.short[c.id] ?? shortName(c.name)}
                x={at.x}
                y={at.y}
                lio={lio}
                sae={sae}
                stability={c.stability}
                control={controller(pub, c.id) ?? "none"}
                battleground={isBattleground(pub, c.id)}
                touched={touched.has(c.id)}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}
