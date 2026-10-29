// The map (docs/architecture.md, Decision 6). Zoomed out: one badge per country, grouped by region, each
// showing the country's net influence in its controller's colour, under a button per region that zooms in.
// Zoomed into a region: that region's countries as full boxes with stability and both sides' influence. It reads
// only the frame's public map and influence; who controls a country comes from the engine's `controller`. Both
// views start with the two home boxes, which are not countries and cannot be tapped (A14, #439).
// No hooks: the zoom comes in as props (ZoomableMap.tsx holds it), so tests can walk it without a browser.
import { SIDES, controller } from "@terminal-dusk/engine";
import type { Country, GameMap, InfluenceEntry, PublicState, Region, RegionId } from "@terminal-dusk/engine";
import { SIDE_NAME } from "../displayText.ts";

/** The tap-target size used across the app (App.tsx): at least 44 by 44 CSS px. */
const TAP = { minHeight: 44, minWidth: 44 } as const;

export type Zoom = RegionId | null;
export type OnZoom = (zoom: Zoom) => void;

/** A country's influence, looked up by its id; a country with no entry has 0 for both sides. */
export function influenceOf(influence: InfluenceEntry[] | undefined, country: Country): { lio: number; sae: number } {
  const entry = influence?.find((e) => e.country === country.id);
  return { lio: entry?.lio ?? 0, sae: entry?.sae ?? 0 };
}

/** The larger side's influence minus the smaller's; 0 when they are equal. */
export function netInfluence(influence: InfluenceEntry[] | undefined, country: Country): number {
  const { lio, sae } = influenceOf(influence, country);
  return Math.abs(lio - sae);
}

/** The zoom to draw: the asked-for region when the map has it, otherwise null (the whole map). */
export function shownZoom(map: GameMap | undefined, zoom: Zoom): Zoom {
  if (zoom === null || map === undefined) return null;
  return map.regions.some((r) => r.id === zoom) ? zoom : null;
}

const controlOf = (pub: PublicState, country: Country): string => controller(pub, country.id) ?? "none";
const countriesIn = (map: GameMap, region: Region): Country[] => map.countries.filter((c) => c.region === region.id);

function Badge({ pub, country }: Readonly<{ pub: PublicState; country: Country }>) {
  return (
    <li className="map-badge" data-country={country.id} data-control={controlOf(pub, country)} title={country.name}>
      <span className="map-badge-name">{country.name}</span>{" "}
      <span className="map-badge-net">{netInfluence(pub.influence, country)}</span>
    </li>
  );
}

function RegionGroup({
  pub,
  map,
  region,
  onZoom,
}: Readonly<{ pub: PublicState; map: GameMap; region: Region; onZoom: OnZoom }>) {
  const headingId = `map-region-${region.id}`;
  return (
    <div className="map-region" data-region={region.id}>
      <h3 id={headingId}>
        <button type="button" style={TAP} onClick={() => onZoom(region.id)}>
          {region.name}
        </button>
      </h3>
      <ul aria-labelledby={headingId}>
        {countriesIn(map, region).map((c) => (
          <Badge key={c.id} pub={pub} country={c} />
        ))}
      </ul>
    </div>
  );
}

/** One labelled number in a country box. */
function Stat({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <span className="map-box-stat">
      {`${label} `}
      <b>{value}</b>
    </span>
  );
}

/** The two home boxes, one per side, in its colour. Home boxes are not countries: no influence, no stability. */
function HomeBoxes() {
  return (
    <ul className="map-homes" aria-label="Home boxes">
      {SIDES.map((side) => (
        <li key={side} className="map-home" data-home={side}>
          {`${SIDE_NAME[side]} home box`}
        </li>
      ))}
    </ul>
  );
}

function CountryBox({ pub, map, country }: Readonly<{ pub: PublicState; map: GameMap; country: Country }>) {
  const { lio, sae } = influenceOf(pub.influence, country);
  return (
    <li className="map-box" data-country={country.id} data-control={controlOf(pub, country)} style={TAP}>
      <span className="map-box-name">{country.name}</span>
      <Stat label="Stability" value={country.stability} />
      <Stat label="LIO" value={lio} />
      <Stat label="SAE" value={sae} />
      {SIDES.filter((side) => map.homeBox[side].includes(country.id)).map((side) => (
        <span key={side} className="map-box-home">{`Next to ${SIDE_NAME[side]} home`}</span>
      ))}
    </li>
  );
}

function ZoomedRegion({
  pub,
  map,
  region,
  onZoom,
}: Readonly<{ pub: PublicState; map: GameMap; region: Region; onZoom: OnZoom }>) {
  const headingId = `map-region-${region.id}`;
  return (
    <div className="map-region map-zoomed" data-region={region.id}>
      <button type="button" style={TAP} onClick={() => onZoom(null)}>
        Whole map
      </button>
      <HomeBoxes />
      <h3 id={headingId}>{region.name}</h3>
      <ul aria-labelledby={headingId}>
        {countriesIn(map, region).map((c) => (
          <CountryBox key={c.id} pub={pub} map={map} country={c} />
        ))}
      </ul>
    </div>
  );
}

/**
 * The map at the given zoom, under the home boxes: the whole map's badges region by region in the map's order, or
 * one region's boxes. A zoom naming a region the map lacks draws the whole map. No map: a line saying so, and no zoom.
 */
export function MapView({ pub, zoom, onZoom }: Readonly<{ pub: PublicState; zoom: Zoom; onZoom: OnZoom }>) {
  const { map } = pub;
  if (map === undefined) return <p>No map in this game</p>;
  const shown = shownZoom(map, zoom);
  const zoomed = map.regions.find((r) => r.id === shown);
  if (zoomed) return <ZoomedRegion pub={pub} map={map} region={zoomed} onZoom={onZoom} />;
  return (
    <>
      <HomeBoxes />
      {map.regions.map((region) => (
        <RegionGroup key={region.id} pub={pub} map={map} region={region} onZoom={onZoom} />
      ))}
    </>
  );
}
