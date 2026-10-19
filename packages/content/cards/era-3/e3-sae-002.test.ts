// e3-sae-002 Belt and Road: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-002", "Belt and Road", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["points:lio:2", "corridors", "points:sae:3", "unanswered", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: [
      "points:lio:2",
      "corridors",
      "points:sae:3",
      "mod:lio:-1:min1",
      "triggerSet:turnEnd",
      "points:lio:1",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ],
  },
]);
