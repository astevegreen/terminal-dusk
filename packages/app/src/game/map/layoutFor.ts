// Which drawing a frame's map gets (L2, #465): the hand-made six-region one when it places every region and
// country of the map, otherwise autoLayout's grid.
import type { GameMap } from "@terminal-dusk/engine";
import { autoLayout } from "./autoLayout.ts";
import { covers } from "./layout.ts";
import type { MapLayout } from "./layout.ts";
import { SIX_REGION_LAYOUT } from "./sixRegionLayout.ts";

export const layoutFor = (map: GameMap): MapLayout =>
  covers(SIX_REGION_LAYOUT, map) ? SIX_REGION_LAYOUT : autoLayout(map);
