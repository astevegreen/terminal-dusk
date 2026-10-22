// e3-sae-002 Belt and Road: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

/** LIO's first play when LIO plays the card: its 3 points for points, or a filler's 2 after picking it to open. */
const lioFirst = { points: 3, opening: 2 } as const;

/** The story when LIO plays the card and says no: SAE spends 2, not 3. */
const rivalNo = (rival: "points" | "opening") => `
  corridors
  points:sae:2
  unanswered
  points:lio:${lioFirst[rival]}
  points:sae:2
  points:lio:2
  points:sae:2
`;

describeCard("e3-sae-002", "Belt and Road", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      points:lio:2
      corridors
      points:sae:3
      unanswered
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      points:lio:2
      corridors
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
    it: "when LIO plays it for points and says no, SAE spends 2",
    rival: "points",
    yes: { lio: false },
    story: rivalNo("points"),
  },
  {
    it: "when LIO picks it as its opening card and says no, SAE spends 2",
    rival: "opening",
    yes: { lio: false },
    story: rivalNo("opening"),
  },
  {
    it: "when LIO plays it for points and says yes, SAE spends 2 and LIO's challenge is as when SAE plays it",
    rival: "points",
    yes: { lio: true },
    story: `
      corridors
      points:sae:2
      mod:lio:-1:min1
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      points:lio:1
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
]);
