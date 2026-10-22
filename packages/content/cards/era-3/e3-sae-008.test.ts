// e3-sae-008 Syrian Intervention: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

/** LIO's first play when LIO plays the card: its 3 points for points, or a filler's 2 after picking it to open. */
const lioFirst = { points: 3, opening: 2 } as const;

/** The story when LIO plays the card: "proxy war" is still recorded, SAE spends 2 now and nothing at turn end. */
const syriaByLio = (rival: "points" | "opening") => `
  lasting:proxy war
  points:sae:2
  points:lio:${lioFirst[rival]}
  points:sae:2
  points:lio:2
  points:sae:2
`;

describeCard("e3-sae-008", "Syrian Intervention", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      lasting:proxy war
      points:sae:2
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
  {
    it: "when LIO plays it for points, SAE spends 2 and no point at turn end",
    rival: "points",
    story: syriaByLio("points"),
  },
  {
    it: "when LIO picks it as its opening card, SAE spends 2 and no point at turn end",
    rival: "opening",
    story: syriaByLio("opening"),
  },
]);
