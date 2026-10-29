# Where the world map comes from (L3, #479)

The real-geography map is made from two free sources. `pnpm --filter @terminal-dusk/app map:build` turns them into
the two files committed here.

| File here         | Made from                                                                                              | Licence                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `blueMarble.webp` | NASA Blue Marble Next Generation, July 2004, with sea floor: `world.topo.bathy.200407.3x5400x2700.jpg` | Public domain (NASA). Credit asked: NASA Earth Observatory |
| `worldArt.json`   | Natural Earth 1:50m Admin 0 countries: `ne_50m_admin_0_countries.geojson`                              | Public domain (Natural Earth)                              |

Downloads:

- Picture: https://visibleearth.nasa.gov/images/73909, the 5400 by 2700 JPEG.
- Countries: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson

## The credit

The map's toolbar shows "Blue Marble imagery: NASA Earth Observatory" while the drawn map is open. NASA asks for
the credit. Its logo is not used: NASA does not allow the logo to suggest it endorses a product.

## What the build does

- **Crop** (`crop.json`): 125°W to 155°E and 72°N to 46°S, 7 map units to the degree, so the map is 1960 by 826
  units. The picture is cut to the same box (pixels 825 to 5025 across and 270 to 2040 down), scaled to 2800 by 1180,
  and saved as WebP at the best quality that fits in 500 KB.
- **Borders**: UN-recognised, as the owner decided. Kosovo is drawn inside Serbia, Somaliland inside Somalia,
  Northern Cyprus inside Cyprus, and Crimea inside Ukraine. A border is an edge two countries share, so no coast is
  drawn over the picture.
- **Shapes**: one per game country, for its region's tint. Natural Earth's default file draws Crimea as a piece of
  Russia; the build gives that piece to Ukraine (so no border cuts it off) and uses its outline as the game's Crimea.
  (A file that draws Crimea inside Ukraine gets Ukraine's land between 32°E and 37°E, south of 46.15°N, instead.) France's is only its European land. Points are rounded to whole map units, and specks under 2 square
  units are dropped.

## Rebuilding

1. Save both downloads in `packages/app/map-sources/` (git ignores that folder; `map-sources/` at the top of the
   repository works too).
2. Run `pnpm --filter @terminal-dusk/app map:build`.
3. Run the app's tests: `worldArt.test.ts` checks every game country has a shape around its place, and that both
   files are within their size budgets.
