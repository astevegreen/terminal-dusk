// e1-lio-014 End of the Soviet Union: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-014", "End of the Soviet Union", [
  {
    it: "when SAE holds the new states together, SAE spends 1 and counts 1 less this turn",
    yes: { sae: true },
    story: `
      red flag lowered
      points:lio:2
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when SAE lets them go, LIO spends 1 at the end of the turn",
    yes: { sae: false },
    story: `
      red flag lowered
      points:lio:2
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
]);
