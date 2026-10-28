// A map's scoring (docs/design/map-and-points.md, "Scoring"): the score track's end and start, and what each region is
// worth at an era's end. It has the shape of the engine's MapScoring and refuses what the engine's scoringError
// refuses, each problem at its path. The numbers are the scenario's own: the schema checks their kind, not their size.
import * as z from "zod";

/** What one region is worth to a side by its highest level. The order of the three amounts is not checked. */
const regionAmounts = z.strictObject({
  region: z.string().min(1),
  present: z.int().min(0),
  ahead: z.int().min(0),
  all: z.int().min(0),
});

/** The track runs from LIO's end at -end to SAE's end at +end; `regions` scores in its own order. */
export const scoringSchema = z.strictObject({
  track: z.strictObject({ end: z.int().min(1), start: z.int() }),
  regions: z.array(regionAmounts),
});

type ScoringMap = {
  regions: readonly { id: string }[];
  scoring?: { track: { end: number; start: number }; regions: readonly { region: string }[] };
};

/**
 * The track starts strictly between its ends, and the scoring list names every region of the map once. A map with
 * no scoring has nothing to check.
 */
export function checkScoring(map: ScoringMap, ctx: z.RefinementCtx): void {
  if (map.scoring === undefined) return;
  const { track, regions } = map.scoring;
  if (Math.abs(track.start) >= track.end) {
    ctx.addIssue({
      code: "custom",
      path: ["scoring", "track", "start"],
      message: `The track must start strictly between -${track.end} and ${track.end}.`,
    });
  }
  const known = new Set(map.regions.map((r) => r.id));
  const seen = new Set<string>();
  regions.forEach((entry, i) => {
    const path = ["scoring", "regions", i, "region"];
    if (!known.has(entry.region)) ctx.addIssue({ code: "custom", path, message: `Unknown region ${entry.region}.` });
    else if (seen.has(entry.region))
      ctx.addIssue({ code: "custom", path, message: `${entry.region} is listed twice.` });
    seen.add(entry.region);
  });
  for (const r of map.regions) {
    if (!seen.has(r.id)) {
      ctx.addIssue({ code: "custom", path: ["scoring", "regions"], message: `Region ${r.id} is not scored.` });
    }
  }
}
