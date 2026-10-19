// e1-lio-003 Dayton Accords: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-003", "Dayton Accords", [
  {
    it: "plays out as its text says",
    story: `
      peace enforced
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
