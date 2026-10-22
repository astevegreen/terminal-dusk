// e2-lio-007 Big Bang Enlargement 2004: one test for each way its effect can play out.
import { describeOnceOnly } from "../../src/test/cardEnds.ts";
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
  {
    it: "after Maastricht Treaty recorded union founded, LIO spends 2 at turn end",
    before: ["e1-lio-001"],
    story: `
      eastward
      points:lio:3
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:2
    `,
  },
]);

describeOnceOnly("e2-lio-007", "Big Bang Enlargement 2004");
