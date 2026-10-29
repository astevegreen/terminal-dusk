// The drawn map (L2, #465): one wrapper the size of the layout, which mapControl.ts moves by a CSS transform.
// Inside it, on a real-geography map (L3, #479), the world picture and its tinted countries and borders
// (artLayer.tsx); then a drawing (hidden from readers) that shades each region, greyed when closed, and draws the
// lines between neighbours, from each home box to its countries, and from offset markers to their places; a button
// over each region zooms to it; each region's standings chip sits under its name (L8, #488); and the markers sit on
// top. It reads only the frame's public part, through the engine's pure helpers (the closed regions, the
// battlegrounds and the region standings by way of the host, as the app's boundary allows). No hooks: ZoomableMap holds the refs and the
// zoom, so tests can render and walk it without a browser. When a decision asks for a country (L7, #487), the
// countries it lists glow and the rest dim (mapPicks.ts).
import { SIDES, controller } from "@terminal-dusk/engine";
import type { CountryId, PublicState, RegionId } from "@terminal-dusk/engine";
import { closedRegions, isBattleground } from "@terminal-dusk/host/first-deck";
import type { Ref } from "react";
import { SIDE_NAME } from "../../displayText.ts";
import { influenceOf } from "../MapView.tsx";
import { neighbourPairs, shortName } from "./layout.ts";
import type { MapLayout, Point } from "./layout.ts";
import { Marker, placeOf } from "./Marker.tsx";
import { Leaders, TONES, Tints, WorldPicture } from "./artLayer.tsx";
import type { Beat } from "./pulse.ts";
import { RegionChips } from "./RegionChips.tsx";
import { pickState } from "./mapPicks.ts";
import type { MapPicks } from "./mapPicks.ts";

export type DrawnMapProps = {
  pub: PublicState;
  layout: MapLayout;
  touched: ReadonlySet<CountryId>;
  /** The pulse's beat for the touched countries (pulse.ts); 0 when not given. */
  beat?: Beat | undefined;
  onRegion: (region: RegionId) => void;
  /** The countries the waiting decision lets you pick; left out, none glows. */
  picks?: MapPicks | undefined;
  viewportRef?: Ref<HTMLDivElement> | undefined;
  wrapperRef?: Ref<HTMLDivElement> | undefined;
};

function Line({ className, from, to, home }: Readonly<{ className: string; from: Point; to: Point; home?: string }>) {
  return <line className={className} data-home={home} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
}

/** The drawing under the markers: tints and borders, region areas, neighbour, home-box and leader lines. */
function Picture({ pub, layout }: Readonly<{ pub: PublicState; layout: MapLayout }>) {
  const map = pub.map!;
  const { w, h } = layout.size;
  const shut = closedRegions(pub);
  return (
    <svg className="dm-lines" aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {layout.art !== undefined && <Tints art={layout.art} map={map} closed={shut} />}
      {map.regions.map((region, i) => {
        const r = layout.regions[region.id]!;
        const closed = shut.includes(region.id);
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
      <Leaders layout={layout} />
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
export function DrawnMap({
  pub,
  layout,
  touched,
  beat = 0,
  onRegion,
  picks,
  viewportRef,
  wrapperRef,
}: Readonly<DrawnMapProps>) {
  const { map } = pub;
  if (map === undefined) return null;
  return (
    <div className="dm-view" ref={viewportRef}>
      <div
        className="dm-world"
        data-art={layout.art === undefined ? undefined : "true"}
        style={{ width: layout.size.w, height: layout.size.h }}
        ref={wrapperRef}
      >
        {layout.art !== undefined && <WorldPicture art={layout.art} layout={layout} />}
        <Picture pub={pub} layout={layout} />
        <RegionButtons pub={pub} layout={layout} onRegion={onRegion} />
        <RegionChips pub={pub} layout={layout} />
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
                pulse={touched.has(c.id) ? beat : undefined}
                pick={pickState(picks, c.id)}
                choice={picks?.choices.get(c.id)?.text}
                on={picks?.on}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}
