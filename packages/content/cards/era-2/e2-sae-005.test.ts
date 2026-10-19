// e2-sae-005 Litvinenko Poisoning: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-005", "Litvinenko Poisoning", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      points:lio:2
      polonium
      points:sae:1
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
      polonium
      points:sae:1
      points:lio:1
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
]);
