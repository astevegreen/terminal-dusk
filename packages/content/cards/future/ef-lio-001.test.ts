// ef-lio-001 Allied Drone Wall: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("ef-lio-001", "Allied Drone Wall", [
  {
    it: "plays out as its text says",
    story: `
      sensors along the frontier
      points:lio:1
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
]);
