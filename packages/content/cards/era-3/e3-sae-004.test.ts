// e3-sae-004 Full-Scale Invasion: one test for each way its effect can play out.
import { describeOnceOnly } from "../../src/test/cardEnds.ts";
import { describeCard } from "../../src/test/describeCard.ts";

/** LIO's first play when LIO plays the card: its 4 points for points, or a filler's 2 after picking it to open. */
const lioFirst = { points: 4, opening: 2 } as const;

/** The story when LIO plays the card: SAE 3 and LIO 1 at turn end, with no -1 on LIO's points. */
const invasionByLio = (rival: "points" | "opening") => `
  full-scale war
  points:sae:3
  triggerSet:turnEnd
  points:lio:${lioFirst[rival]}
  points:sae:2
  points:lio:2
  points:sae:2
  triggerFired:turnEnd
  points:lio:1
`;

describeCard("e3-sae-004", "Full-Scale Invasion", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      full-scale war
      points:sae:3
      mod:lio:-1:min1
      triggerSet:turnEnd
      points:lio:1
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "when LIO plays it for points, LIO's points do not count 1 less",
    rival: "points",
    story: invasionByLio("points"),
  },
  {
    it: "when LIO picks it as its opening card, LIO's points do not count 1 less",
    rival: "opening",
    story: invasionByLio("opening"),
  },
  {
    it: "on the map: Escalation rises 2 to 3 after the turn-end trigger is set, as the event's last step",
    map: true,
    story: `
      points:lio:2
      full-scale war
      points:sae:3
      mod:lio:-1:min1
      triggerSet:turnEnd
      escalation:2:3
      points:lio:1
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
      escalation:3:2
    `,
  },
  {
    it: "on the map, when LIO plays it for points: Escalation still rises 2 to 3",
    map: true,
    rival: "points",
    story: `
      full-scale war
      points:sae:3
      triggerSet:turnEnd
      escalation:2:3
      points:lio:4
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
      escalation:3:2
    `,
  },
]);

describeOnceOnly("e3-sae-004", "Full-Scale Invasion");
