// e3-sae-011 Hong Kong Security Law: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-011", "Hong Kong Security Law", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["points:lio:2", "promise ended", "points:sae:2", "no sanctions", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: [
      "points:lio:2",
      "promise ended",
      "points:sae:2",
      "points:lio:1",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ],
  },
]);
