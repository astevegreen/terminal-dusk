// `pnpm map:build` (L3, #479): makes the real-geography map's two files from the two downloads in map-sources/
// (world/SOURCES.md says where each comes from):
//   src/game/map/world/blueMarble.webp - NASA's Blue Marble picture cut to the crop and scaled to 2800 by 1180
//   src/game/map/world/worldArt.json   - each game country's shape and the land borders, in the map's units
// The picture is cut, scaled and saved as WebP by the Chromium that Playwright already brings, so the build needs no
// image library. Run it again only when a source or crop.json changes; both outputs are committed.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { bordersPath, countriesOf, gameShapes, projectorOf } from "./geometry.mjs";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const world = join(app, "src/game/map/world");
const PICTURE = "world.topo.bathy.200407.3x5400x2700.jpg";
const COUNTRIES = "ne_50m_admin_0_countries.geojson";
/** The picture's size in the game: two thirds of the cut, sharp enough at the map's closest zoom. */
const OUT = { w: 2800, h: 1180 };
const MAX_PICTURE_BYTES = 500 * 1024;

/** The downloads' folder: packages/app/map-sources, or map-sources at the top of the repository. */
function sourcesFolder() {
  for (const dir of [join(app, "map-sources"), resolve(app, "../../map-sources")])
    if (existsSync(join(dir, PICTURE)) && existsSync(join(dir, COUNTRIES))) return dir;
  throw new Error(`Save ${PICTURE} and ${COUNTRIES} in packages/app/map-sources/ (see world/SOURCES.md).`);
}

function buildArt(dir, crop) {
  const features = JSON.parse(readFileSync(join(dir, COUNTRIES), "utf8")).features;
  const countries = countriesOf(features);
  const project = projectorOf(crop);
  const art = { shapes: gameShapes(countries, project, crop), borders: bordersPath(countries, project, crop) };
  const empty = Object.entries(art.shapes).filter(([, d]) => d === "");
  if (empty.length > 0) throw new Error(`No shape for ${empty.map(([id]) => id).join(", ")}`);
  writeFileSync(join(world, "worldArt.json"), `${JSON.stringify(art)}\n`);
}

async function buildPicture(dir, crop) {
  const jpeg = readFileSync(join(dir, PICTURE)).toString("base64");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const webp = await page.evaluate(
      async ({ jpeg, out, max, crop }) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${jpeg}`;
        await img.decode();
        // The picture is equirectangular, the whole world from 180°W and 90°N: so many pixels to the degree.
        const px = img.naturalWidth / 360;
        const cut = [
          (crop.west + 180) * px,
          (90 - crop.north) * px,
          (crop.east - crop.west) * px,
          (crop.north - crop.south) * px,
        ];
        const canvas = document.createElement("canvas");
        canvas.width = out.w;
        canvas.height = out.h;
        const g = canvas.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(img, ...cut, 0, 0, out.w, out.h);
        // The best quality that fits the size budget.
        for (let q = 85; q >= 60; q -= 5) {
          const url = canvas.toDataURL("image/webp", q / 100);
          if ((url.length - url.indexOf(",") - 1) * 0.75 <= max) return url;
        }
        return null;
      },
      { jpeg, out: OUT, max: MAX_PICTURE_BYTES, crop },
    );
    if (webp === null) throw new Error(`The picture does not fit in ${MAX_PICTURE_BYTES} bytes at quality 60.`);
    writeFileSync(join(world, "blueMarble.webp"), Buffer.from(webp.slice(webp.indexOf(",") + 1), "base64"));
  } finally {
    await browser.close();
  }
}

const crop = JSON.parse(readFileSync(join(world, "crop.json"), "utf8"));
const dir = sourcesFolder();
console.log(`Building the world map from ${dir}`);
buildArt(dir, crop);
await buildPicture(dir, crop);
for (const name of ["blueMarble.webp", "worldArt.json"])
  console.log(`${name}: ${Math.round(statSync(join(world, name)).size / 1024)} KB`);
