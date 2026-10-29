// A map's tech race track (docs/design/tech-race.md, "The track"): its named steps from parity outwards with their
// costs, the draw that moves the marker, and the step whose entry raises Escalation. It has the shape of the engine's
// MapTechRace and refuses what the engine's techRaceError refuses, each problem at its path. The numbers are the
// scenario's own: the schema checks their kind, not their size.
import * as z from "zod";

const techStep = z.strictObject({ name: z.string().min(1), cost: z.int().min(1) });

/** At least one step; `success` and `escalateAt` whole numbers, 1 or more. */
export const techRaceSchema = z.strictObject({
  steps: z.array(techStep).min(1),
  success: z.int().min(1),
  escalateAt: z.int().min(1),
});

type TechRaceMap = { techRace?: { steps: readonly unknown[]; escalateAt: number } };

/** The Escalation step is a step of the track. A map with no tech race has nothing to check. */
export function checkTechRace(map: TechRaceMap, ctx: z.RefinementCtx): void {
  if (map.techRace === undefined) return;
  const { steps, escalateAt } = map.techRace;
  if (escalateAt > steps.length) {
    ctx.addIssue({
      code: "custom",
      path: ["techRace", "escalateAt"],
      message: `The Escalation step must be a step of the track, 1 to ${steps.length}.`,
    });
  }
}
