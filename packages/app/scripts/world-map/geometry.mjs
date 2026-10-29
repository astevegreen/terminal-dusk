// The geometry behind `pnpm map:build` (L3, #479), kept pure so geometry.test.mjs can prove it on small shapes.
// Natural Earth's countries go in as polygons of [longitude, latitude] points. Out come the game countries' shapes
// and one path of land borders, in the map's whole-number units (src/game/map/world/crop.json).
//
// Borders follow the UN-recognised lines, as the owner decided: Kosovo is drawn inside Serbia, Somaliland inside
// Somalia, Northern Cyprus inside Cyprus, and Crimea inside Ukraine. Crimea keeps its own tint shape for its game
// marker: Ukraine's land inside a box around the peninsula.

/** Natural Earth codes drawn as part of another country (UN-recognised borders). */
export const MERGES = Object.freeze({ KOS: "SRB", SOL: "SOM", CYN: "CYP" });

/** The box around Crimea: Russia's land inside it is drawn as Ukraine's, and the game's Crimea is Ukraine inside it. */
export const CRIMEA_BOX = Object.freeze({ west: 32, east: 37, south: 44, north: 46.15 });

/** Rings smaller than this many square units after rounding are dropped: specks a player can't see. */
export const MIN_RING_AREA = 2;

/** Which Natural Earth code is which game country. Crimea is cut from Ukraine; France is only its European land. */
export const GAME_COUNTRIES = Object.freeze({
  canada: "CAN",
  mexico: "MEX",
  cuba: "CUB",
  venezuela: "VEN",
  brazil: "BRA",
  "united-kingdom": "GBR",
  finland: "FIN",
  france: "FRA",
  germany: "DEU",
  poland: "POL",
  italy: "ITA",
  serbia: "SRB",
  greece: "GRC",
  turkey: "TUR",
  iran: "IRN",
  lebanon: "LBN",
  syria: "SYR",
  iraq: "IRQ",
  libya: "LBY",
  israel: "ISR",
  "saudi-arabia": "SAU",
  nigeria: "NGA",
  rwanda: "RWA",
  somalia: "SOM",
  "south-africa": "ZAF",
  estonia: "EST",
  belarus: "BLR",
  ukraine: "UKR",
  crimea: "UKR",
  georgia: "GEO",
  azerbaijan: "AZE",
  kazakhstan: "KAZ",
  kyrgyzstan: "KGZ",
  tajikistan: "TJK",
  afghanistan: "AFG",
  pakistan: "PAK",
  india: "IND",
  "north-korea": "PRK",
  "south-korea": "KOR",
  japan: "JPN",
  taiwan: "TWN",
  australia: "AUS",
});

/** Only these parts of a country count as the game country: France's overseas land is not France on this map. */
export const KEEP_ONLY = Object.freeze({ france: { west: -6, east: 10, south: 41, north: 52 } });

/** Longitude and latitude to the map's whole-number units, as src/game/map/world/projection.ts does. */
export const projectorOf = (crop) => (lon, lat) => ({
  x: Math.round((lon - crop.west) * crop.unitsPerDegree),
  y: Math.round((crop.north - lat) * crop.unitsPerDegree),
});

const inBox = (box, [lon, lat]) => lon >= box.west && lon <= box.east && lat >= box.south && lat <= box.north;

/**
 * Each country's polygons (each a list of rings, the first the outline), by its code after the UN merges, with
 * Russia's land inside the Crimea box given to Ukraine. `features` are GeoJSON features with `properties.ADM0_A3`.
 */
export function countriesOf(features) {
  const out = new Map();
  const add = (code, polygon) => {
    if (!out.has(code)) out.set(code, []);
    out.get(code).push(polygon);
  };
  for (const f of features) {
    const raw = f.properties.ADM0_A3;
    const code = MERGES[raw] ?? raw;
    const g = f.geometry;
    if (g === null) continue;
    const polygons = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const polygon of polygons) {
      const crimean = code === "RUS" && polygon[0].every((p) => inBox(CRIMEA_BOX, p));
      add(crimean ? "UKR" : code, polygon);
    }
  }
  return out;
}

/** A ring cut to a box (Sutherland–Hodgman: the box is convex, so any ring cuts cleanly), in the ring's units. */
export function clipRing(ring, box) {
  const edges = [
    [(p) => p[0] >= box.west, (a, b) => cross(a, b, 0, box.west)],
    [(p) => p[0] <= box.east, (a, b) => cross(a, b, 0, box.east)],
    [(p) => p[1] >= box.south, (a, b) => cross(a, b, 1, box.south)],
    [(p) => p[1] <= box.north, (a, b) => cross(a, b, 1, box.north)],
  ];
  let points = open(ring);
  for (const [inside, meet] of edges) {
    const next = [];
    points.forEach((p, i) => {
      const prev = points[(i + points.length - 1) % points.length];
      if (inside(p)) {
        if (!inside(prev)) next.push(meet(prev, p));
        next.push(p);
      } else if (inside(prev)) next.push(meet(prev, p));
    });
    points = next;
    if (points.length === 0) break;
  }
  return points;
}

/** Where the line from a to b meets the line where coordinate `axis` equals `at`. */
function cross(a, b, axis, at) {
  const t = (at - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

/** A ring without its closing point, if it repeats the first. */
function open(ring) {
  const [first, last] = [ring[0], ring.at(-1)];
  return ring.length > 1 && first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring.slice();
}

/** A ring's area by the shoelace rule, unsigned. */
export function areaOf(ring) {
  let twice = 0;
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    twice += p[0] * q[1] - q[0] * p[1];
  });
  return Math.abs(twice) / 2;
}

/** Points to whole numbers, without a point that repeats the one before it (or the first, at the end). */
export function rounded(points, project) {
  const out = [];
  for (const p of points) {
    const { x, y } = project(p[0], p[1]);
    const last = out.at(-1);
    if (last === undefined || last[0] !== x || last[1] !== y) out.push([x, y]);
  }
  while (out.length > 1 && out[0][0] === out.at(-1)[0] && out[0][1] === out.at(-1)[1]) out.pop();
  return out;
}

/** A filled shape's path: each ring cut to the crop, rounded, and kept only when it is big enough to see. */
export function shapePath(polygons, project, crop) {
  let d = "";
  for (const polygon of polygons)
    for (const ring of polygon) {
      const points = rounded(clipRing(ring, crop), project);
      if (points.length < 3 || areaOf(points) < MIN_RING_AREA) continue;
      d += `M${points.map(([x, y]) => `${x} ${y}`).join("L")}Z`;
    }
  return d;
}

/** Each game country's shape path: Crimea is Ukraine cut to the Crimea box, France only its European land. */
export function gameShapes(countries, project, crop) {
  const shapes = {};
  for (const [id, code] of Object.entries(GAME_COUNTRIES)) {
    let polygons = countries.get(code) ?? [];
    const only = id === "crimea" ? CRIMEA_BOX : KEEP_ONLY[id];
    if (only !== undefined)
      polygons = polygons
        .map((polygon) => polygon.map((ring) => clipRing(ring, only)).filter((ring) => ring.length >= 3))
        .filter((polygon) => polygon.length > 0);
    shapes[id] = shapePath(polygons, project, crop);
  }
  return shapes;
}

const keyOf = (a, b) => {
  const [p, q] = [`${a[0]},${a[1]}`, `${b[0]},${b[1]}`];
  return p < q ? `${p}|${q}` : `${q}|${p}`;
};

/**
 * The land borders: every edge two different countries share, as one path of lines in the map's units. Natural
 * Earth draws neighbours with the same points along their border, so a shared edge is one both countries have. Each
 * border is drawn once, from the country whose code sorts first; edges wholly outside the crop are left out.
 */
export function bordersPath(countries, project, crop) {
  const owners = new Map();
  const eachEdge = (code, visit) => {
    for (const polygon of countries.get(code))
      for (const ring of polygon) {
        const points = open(ring);
        points.forEach((a, i) => visit(a, points[(i + 1) % points.length]));
      }
  };
  for (const code of countries.keys())
    eachEdge(code, (a, b) => {
      const key = keyOf(a, b);
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(code);
    });

  const runs = [];
  for (const code of [...countries.keys()].sort()) {
    let run = [];
    const end = () => {
      if (run.length > 1) runs.push(run);
      run = [];
    };
    eachEdge(code, (a, b) => {
      const others = [...owners.get(keyOf(a, b))].filter((c) => c !== code);
      const drawnHere = others.length > 0 && others.every((c) => c > code);
      const seen = inBox(crop, a) || inBox(crop, b);
      if (!drawnHere || !seen) return end();
      if (run.length === 0) run.push(a);
      run.push(b);
    });
    end();
  }
  let d = "";
  for (const run of runs) {
    const points = [];
    for (const p of run) {
      const { x, y } = project(p[0], p[1]);
      const last = points.at(-1);
      if (last === undefined || last[0] !== x || last[1] !== y) points.push([x, y]);
    }
    if (points.length > 1) d += `M${points.map(([x, y]) => `${x} ${y}`).join("L")}`;
  }
  return d;
}
