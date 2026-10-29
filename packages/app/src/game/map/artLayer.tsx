// The real-geography map's artwork (L3, #479), drawn under the markers: the Blue Marble picture, each region's
// countries tinted in its tone (greyed when the region is closed), the land borders over them, and a leader line
// with a dot at the true place for each marker that sits away from its country. Nothing here for a layout without
// art, such as autoLayout's test maps.
import type { GameMap, RegionId } from "@terminal-dusk/engine";
import { leaderLines } from "./layout.ts";
import type { MapLayout, WorldArt } from "./layout.ts";

/** How many region tints mapTheme.css has; regions take them in the map's order, as the region areas do. */
export const TONES = 6;

/** The picture, at the drawing's size: hidden from readers, and never dragged as an image. */
export function WorldPicture({ art, layout }: Readonly<{ art: WorldArt; layout: MapLayout }>) {
  return (
    <img
      className="dm-picture"
      src={art.picture}
      alt=""
      draggable={false}
      width={layout.size.w}
      height={layout.size.h}
    />
  );
}

/** One tint per region, its countries' shapes in one path, then the borders over them all. */
export function Tints({ art, map, closed }: Readonly<{ art: WorldArt; map: GameMap; closed: readonly RegionId[] }>) {
  return (
    <>
      {map.regions.map((region, i) => (
        <path
          key={region.id}
          className="dm-tint"
          data-region={region.id}
          data-closed={closed.includes(region.id) ? "true" : undefined}
          data-tone={i % TONES}
          d={map.countries
            .filter((c) => c.region === region.id)
            .map((c) => art.shapes[c.id] ?? "")
            .join("")}
        />
      ))}
      <path className="dm-borders" d={art.borders} />
    </>
  );
}

/** A line from each offset marker to its country's true place, with a dot at the place. */
export function Leaders({ layout }: Readonly<{ layout: MapLayout }>) {
  return leaderLines(layout).map(({ country, from, to }) => (
    <g key={country}>
      <line className="dm-leader" data-country={country} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <circle className="dm-place" data-country={country} cx={to.x} cy={to.y} r={5} />
    </g>
  ));
}
