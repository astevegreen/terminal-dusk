// e3-neu-001 Arab Spring: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-001", "Arab Spring", [
  {
    it: "when LIO says no and SAE says no",
    yes: { lio: false, sae: false },
    story: ["the square", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says no and SAE says yes",
    yes: { lio: false, sae: true },
    story: [
      "the square",
      "points:sae:1",
      "mod:sae:-1:min1",
      "triggerSet:turnEnd",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
      "triggerFired:turnEnd",
      "points:lio:1",
    ],
  },
  {
    it: "when LIO says yes and SAE says no",
    yes: { lio: true, sae: false },
    story: [
      "the square",
      "points:lio:1",
      "mod:lio:-1:min1",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ],
  },
  {
    it: "when LIO says yes and SAE says yes",
    yes: { lio: true, sae: true },
    story: [
      "the square",
      "points:lio:1",
      "mod:lio:-1:min1",
      "points:sae:1",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:1",
      "points:sae:1",
    ],
  },
]);
