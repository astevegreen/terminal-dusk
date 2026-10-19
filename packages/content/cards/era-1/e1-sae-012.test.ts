// e1-sae-012 Shock Therapy Backlash: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-012", "Shock Therapy Backlash", [
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      points:lio:2
      reform backlash
      points:sae:2
      points:lio:1
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      points:lio:2
      reform backlash
      points:sae:2
      left to themselves
      points:lio:2
      points:sae:2
    `,
  },
]);
