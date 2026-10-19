// e2-lio-007 Big Bang Enlargement 2004: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-007", "Big Bang Enlargement 2004", [
  {
    it: "plays out as its text says",
    story: `
      eastward
      points:lio:3
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
]);
