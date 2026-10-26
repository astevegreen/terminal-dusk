// The map a scenario can carry (docs/design/map-and-points.md, "Map" and "Influence"): regions, countries, the
// countries next to each home box, and starting influence. It has the shape of the engine's SetupMap and refuses
// what the engine's createGame refuses in a map (mapChecks.ts), each problem at its path.
// scenario.types.test.ts checks it against the engine's type.
import * as z from "zod";

const name = z.string().min(1);

const region = z.strictObject({ id: name, name });

const country = z.strictObject({
  id: name,
  name,
  region: name,
  stability: z.int().min(1),
  battleground: z.boolean(),
  neighbours: z.array(name),
});

const influenceEntry = z.strictObject({ country: name, lio: z.int().min(0), sae: z.int().min(0) });

type MapShape = {
  regions: readonly { id: string }[];
  countries: readonly { id: string; region: string; neighbours: readonly string[] }[];
  homeBox: { lio: readonly string[]; sae: readonly string[] };
  startingInfluence: readonly { country: string }[];
};

/** Region ids are not repeated, and each region holds at least one country. */
function checkRegions(map: MapShape, ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  map.regions.forEach((r, i) => {
    if (seen.has(r.id))
      ctx.addIssue({ code: "custom", path: ["regions", i, "id"], message: `Two regions share the id ${r.id}.` });
    seen.add(r.id);
  });
  const used = new Set(map.countries.map((c) => c.region));
  map.regions.forEach((r, i) => {
    // An empty id is already refused at the id; one problem gets one message.
    if (r.id !== "" && !used.has(r.id))
      ctx.addIssue({ code: "custom", path: ["regions", i], message: `Region ${r.id} has no country.` });
  });
}

/** Country ids are not repeated, and each country is in a known region. */
function checkCountries(map: MapShape, ctx: z.RefinementCtx): void {
  const regionIds = new Set(map.regions.map((r) => r.id));
  const seen = new Set<string>();
  map.countries.forEach((c, i) => {
    if (seen.has(c.id)) {
      ctx.addIssue({ code: "custom", path: ["countries", i, "id"], message: `Two countries share the id ${c.id}.` });
    }
    seen.add(c.id);
    if (!regionIds.has(c.region)) {
      ctx.addIssue({ code: "custom", path: ["countries", i, "region"], message: `Unknown region ${c.region}.` });
    }
  });
}

/** Each neighbour is a known country other than itself, listed once, that lists this country back. */
function checkAdjacency(map: MapShape, ctx: z.RefinementCtx): void {
  const byId = new Map<string, MapShape["countries"][number]>();
  for (const c of map.countries) if (!byId.has(c.id)) byId.set(c.id, c);
  map.countries.forEach((c, i) => {
    const seen = new Set<string>();
    c.neighbours.forEach((n, j) => {
      const path = ["countries", i, "neighbours", j];
      const other = byId.get(n);
      let message: string | null = null;
      if (n === c.id) message = `Country ${c.id} lists itself as a neighbour.`;
      else if (seen.has(n)) message = `Country ${c.id} lists neighbour ${n} twice.`;
      else if (!other) message = `Country ${c.id} names unknown neighbour ${n}.`;
      else if (!other.neighbours.includes(c.id))
        message = `Country ${c.id} lists ${n}, but ${n} does not list ${c.id}.`;
      seen.add(n);
      if (message) ctx.addIssue({ code: "custom", path, message });
    });
  });
}

/** Each side's home-box list names known countries, each once; a country may be next to both home boxes. */
function checkHomeBox(map: MapShape, ctx: z.RefinementCtx): void {
  const ids = new Set(map.countries.map((c) => c.id));
  for (const side of ["lio", "sae"] as const) {
    const seen = new Set<string>();
    map.homeBox[side].forEach((id, j) => {
      const path = ["homeBox", side, j];
      if (!ids.has(id))
        ctx.addIssue({ code: "custom", path, message: `The ${side} home box names unknown country ${id}.` });
      else if (seen.has(id)) ctx.addIssue({ code: "custom", path, message: `The ${side} home box names ${id} twice.` });
      seen.add(id);
    });
  }
}

/** Each starting-influence entry names a known country not already listed. Amounts are checked by their schema. */
function checkInfluence(map: MapShape, ctx: z.RefinementCtx): void {
  const ids = new Set(map.countries.map((c) => c.id));
  const seen = new Set<string>();
  map.startingInfluence.forEach((e, i) => {
    const path = ["startingInfluence", i, "country"];
    if (!ids.has(e.country)) ctx.addIssue({ code: "custom", path, message: `Unknown country ${e.country}.` });
    else if (seen.has(e.country)) ctx.addIssue({ code: "custom", path, message: `${e.country} is listed twice.` });
    seen.add(e.country);
  });
}

/**
 * The checks across the map's parts. A map with no regions or no countries is already refused at that list, and
 * nothing else in it can be checked, so it gets only that one message.
 */
function checkMap(map: MapShape, ctx: z.RefinementCtx): void {
  if (map.regions.length === 0 || map.countries.length === 0) return;
  for (const check of [checkRegions, checkCountries, checkAdjacency, checkHomeBox, checkInfluence]) check(map, ctx);
}

/** A scenario's map. No other fields are allowed at any level. A country left out of startingInfluence starts at 0. */
export const mapSchema = z
  .strictObject({
    regions: z.array(region).min(1),
    countries: z.array(country).min(1),
    homeBox: z.strictObject({ lio: z.array(name), sae: z.array(name) }),
    startingInfluence: z.array(influenceEntry),
  })
  .superRefine(checkMap);
