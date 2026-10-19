// e2-sae-006 Gas Cutoff: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-006", "Gas Cutoff", [
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      points:lio:2
      valves closed
      points:sae:1
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      points:lio:2
      valves closed
      points:sae:2
      mod:sae:-1:min1
      triggerSet:turnEnd
      points:lio:2
      points:sae:1
      triggerFired:turnEnd
      points:lio:1
    `,
  },
]);
