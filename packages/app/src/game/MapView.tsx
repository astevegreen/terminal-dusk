// The map zoomed out (docs/architecture.md, Decision 6): one badge per country, grouped by region, each
// showing the country's net influence in its controller's colour. It reads only the frame's public map and
// influence; who controls a country comes from the engine's `controller`, never from code of its own.
import { controller } from "@terminal-dusk/engine";
import type { Country, GameMap, InfluenceEntry, PublicState, Region } from "@terminal-dusk/engine";

/** A country's influence, looked up by its id; a country with no entry has 0 for both sides. */
function influenceOf(influence: InfluenceEntry[] | undefined, country: Country): { lio: number; sae: number } {
  const entry = influence?.find((e) => e.country === country.id);
  return { lio: entry?.lio ?? 0, sae: entry?.sae ?? 0 };
}

/** The larger side's influence minus the smaller's; 0 when they are equal. */
export function netInfluence(influence: InfluenceEntry[] | undefined, country: Country): number {
  const { lio, sae } = influenceOf(influence, country);
  return Math.abs(lio - sae);
}

function Badge({ pub, country }: Readonly<{ pub: PublicState; country: Country }>) {
  const control = controller(pub, country.id) ?? "none";
  return (
    <li className="map-badge" data-country={country.id} data-control={control} title={country.name}>
      <span className="map-badge-name">{country.name}</span>{" "}
      <span className="map-badge-net">{netInfluence(pub.influence, country)}</span>
    </li>
  );
}

function RegionGroup({ pub, map, region }: Readonly<{ pub: PublicState; map: GameMap; region: Region }>) {
  const headingId = `map-region-${region.id}`;
  return (
    <div className="map-region" data-region={region.id}>
      <h3 id={headingId}>{region.name}</h3>
      <ul aria-labelledby={headingId}>
        {map.countries
          .filter((c) => c.region === region.id)
          .map((c) => (
            <Badge key={c.id} pub={pub} country={c} />
          ))}
      </ul>
    </div>
  );
}

/** The map's badges, region by region in the map's order, or a line saying the game has no map. */
export function MapView({ pub }: Readonly<{ pub: PublicState }>) {
  const { map } = pub;
  if (map === undefined) return <p>No map in this game</p>;
  return (
    <>
      {map.regions.map((region) => (
        <RegionGroup key={region.id} pub={pub} map={map} region={region} />
      ))}
    </>
  );
}
