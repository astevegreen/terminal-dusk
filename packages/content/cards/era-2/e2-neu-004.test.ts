// e2-neu-004 IPCC Report and Nobel 2007: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-004", "IPCC Report and Nobel 2007", [
  {
    it: "plays out as its text says",
    story: `
      climate consensus
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
      points:sae:1
    `,
  },
]);
