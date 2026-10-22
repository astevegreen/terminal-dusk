// e3-neu-004 Migration Crises: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-004", "Migration Crises", [
  {
    it: "without proxy war, LIO counts 1 less this turn and spends 1 at turn end",
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
  {
    it: "after Syrian Intervention recorded proxy war, LIO counts 1 less this turn and spends nothing at turn end",
    before: ["e3-sae-008"],
    story: `
      a million arrivals
      mod:lio:-1:min1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
]);
