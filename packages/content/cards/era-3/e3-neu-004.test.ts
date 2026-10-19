// e3-neu-004 Migration Crises: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-004", "Migration Crises", [
  {
    it: "plays out as its text says",
    story: `
      a million arrivals
      mod:lio:-1:min1
      triggerSet:turnEnd
      points:sae:2
      points:lio:1
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
]);
