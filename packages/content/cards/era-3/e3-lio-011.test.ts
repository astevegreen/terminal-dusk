// e3-lio-011 Private Constellation: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-011", "Private Constellation", [
  {
    it: "plays out as its text says",
    story: [
      "constellation",
      "points:lio:1",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ],
  },
]);
