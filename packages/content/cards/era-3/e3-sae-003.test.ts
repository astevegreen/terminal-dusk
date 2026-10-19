// e3-sae-003 Annexation of Crimea: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-003", "Annexation of Crimea", [
  {
    it: "plays out as its text says",
    story: [
      "points:lio:2",
      "borders redrawn",
      "points:sae:3",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ],
  },
]);
