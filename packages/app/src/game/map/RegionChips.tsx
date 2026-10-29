// Region standings on the map (L8, #488): under each region's name, a small chip with one line per side, its level
// there now in the words of docs/design/map-and-points.md ("Scoring": present, ahead, holds every battleground) and the
// points the region would give it if it scored now. Both come from the engine's pure helper regionStanding on the
// frame's public part (Decision 6, by way of the host as the app's boundary allows): no scoring rule is written here.
// Drawn in layout units inside the map's one wrapper, at chipPlaces' spot, so it pans and zooms with the map and never
// covers a marker. A map without scoring has no chips.
import { SIDES } from "@terminal-dusk/engine";
import type { PublicState, RegionLevel, RegionStanding, Side } from "@terminal-dusk/engine";
import { regionStanding } from "@terminal-dusk/host/first-deck";
import { SIDE_NAME } from "../../displayText.ts";
import { chipPlaces } from "./chipPlaces.ts";
import { CHIP } from "./layout.ts";
import type { MapLayout } from "./layout.ts";
import "./regionChips.css";

type Standing = RegionStanding[Side];

/** Each level as the chip shows it; nothing shows no word, only the points. */
const LEVEL_SHOWN: Record<RegionLevel, string> = {
  none: "",
  present: "present",
  ahead: "ahead",
  all: "every battleground",
};

/** Each level as it is read aloud. */
const LEVEL_SAID: Record<RegionLevel, string> = {
  none: "",
  present: "present",
  ahead: "ahead",
  all: "holds every battleground",
};

/** One side's line on a chip, such as "LIO ahead 6", or "SAE 0" for a side with nothing there. */
export const standingLine = (side: Side, { level, points }: Standing): string =>
  [SIDE_NAME[side], LEVEL_SHOWN[level], String(points)].filter((part) => part !== "").join(" ");

const said = (side: Side, { level, points }: Standing): string =>
  level === "none"
    ? `${SIDE_NAME[side]} ${points} points`
    : `${SIDE_NAME[side]} ${LEVEL_SAID[level]}, ${points} points`;

/** A whole chip read aloud, such as "Europe, if it scored now: LIO present, 2 points; SAE 0 points." */
export const standingLabel = (region: string, standing: RegionStanding): string =>
  `${region}, if it scored now: ${said("lio", standing.lio)}; ${said("sae", standing.sae)}.`;

/** Each region's chip, in the map's order; nothing on a map without scoring. */
export function RegionChips({ pub, layout }: Readonly<{ pub: PublicState; layout: MapLayout }>) {
  const map = pub.map;
  const scoring = map?.scoring;
  if (map === undefined || scoring === undefined) return null;
  const places = chipPlaces(layout);
  return (
    <ul className="dm-chips" aria-label="Region standings">
      {map.regions.map((region) => {
        const amounts = scoring.regions.find((r) => r.region === region.id);
        const at = places[region.id];
        if (amounts === undefined || at === undefined) return null;
        const standing = regionStanding(pub, amounts);
        return (
          <li
            key={region.id}
            className="dm-chip"
            data-region={region.id}
            style={{ left: at.x, top: at.y, width: CHIP.w, height: CHIP.h }}
          >
            <span className="dm-sr">{standingLabel(region.name, standing)}</span>
            {SIDES.map((side) => (
              <span
                key={side}
                className="dm-chip-side"
                data-side={side}
                data-level={standing[side].level}
                aria-hidden="true"
              >
                {standingLine(side, standing[side])}
              </span>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
