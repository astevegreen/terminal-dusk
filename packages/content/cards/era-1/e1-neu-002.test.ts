// e1-neu-002 Asian Financial Crisis: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-002", "Asian Financial Crisis", [
  {
    it: "when LIO says yes and SAE says yes",
    yes: { lio: true, sae: true },
    story: [
      "contagion",
      "points:lio:2",
      "mod:lio:-1:min1",
      "points:sae:2",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:1",
      "points:sae:1",
    ],
  },
  {
    it: "when LIO says yes and SAE says no",
    yes: { lio: true, sae: false },
    story: [
      "contagion",
      "points:lio:2",
      "mod:lio:-1:min1",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:1",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ],
  },
  {
    it: "when LIO says no and SAE says yes",
    yes: { lio: false, sae: true },
    story: [
      "contagion",
      "triggerSet:turnEnd",
      "points:sae:2",
      "mod:sae:-1:min1",
      "points:sae:1",
      "points:lio:2",
      "points:sae:1",
      "triggerFired:turnEnd",
      "points:sae:1",
    ],
  },
  {
    it: "when LIO says no and SAE says no",
    yes: { lio: false, sae: false },
    story: [
      "contagion",
      "triggerSet:turnEnd",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "triggerFired:turnEnd",
      "points:sae:1",
      "points:lio:1",
    ],
  },
]);
