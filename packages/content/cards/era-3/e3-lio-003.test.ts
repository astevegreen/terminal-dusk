// e3-lio-003 Ghost Stories: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-003", "Ghost Stories", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      sleepers exposed
      points:lio:2
      no exchange
      discard:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      sleepers exposed
      points:lio:2
      reveal:sae
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
