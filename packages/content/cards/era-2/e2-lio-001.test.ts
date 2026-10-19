// e2-lio-001 Jawbreaker: Fall of the Taliban: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-001", "Jawbreaker: Fall of the Taliban", [
  {
    it: "plays out as its text says",
    story: `
      swift campaign
      points:lio:2
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
]);
