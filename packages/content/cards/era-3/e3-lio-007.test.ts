// e3-lio-007 Sanctions Wall: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-007", "Sanctions Wall", [
  {
    it: "plays out as its text says",
    story: [
      "reserves frozen",
      "points:lio:3",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ],
  },
]);
