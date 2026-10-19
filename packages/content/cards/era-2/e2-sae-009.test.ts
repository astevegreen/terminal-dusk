// e2-sae-009 Argentine Default: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-009", "Argentine Default", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      points:lio:2
      consensus cracks
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      points:lio:2
      consensus cracks
      points:lio:1
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
]);
