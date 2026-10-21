// e2-lio-012 Euro Cash: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-012", "Euro Cash", [
  {
    it: "plays out as its text says",
    story: `
      single currency
      points:lio:1
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "after Maastricht Treaty recorded union founded, LIO spends 2 now",
    before: ["e1-lio-001"],
    story: `
      single currency
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
