// e2-neu-003 SARS: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-003", "SARS", [
  {
    it: "when LIO says no and SAE says no",
    yes: { lio: false, sae: false },
    story: [
      "outbreak",
      "mod:lio:+1",
      "triggerSet:turnEnd",
      "mod:sae:+1",
      "triggerSet:turnEnd",
      "points:sae:3",
      "points:lio:3",
      "points:sae:3",
      "triggerFired:turnEnd",
      "triggerFired:turnEnd",
      "points:sae:2",
      "points:lio:2",
    ],
  },
  {
    it: "when LIO says no and SAE says yes",
    yes: { lio: false, sae: true },
    story: [
      "outbreak",
      "mod:lio:+1",
      "triggerSet:turnEnd",
      "points:sae:1",
      "points:sae:2",
      "points:lio:3",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ],
  },
  {
    it: "when LIO says yes and SAE says no",
    yes: { lio: true, sae: false },
    story: [
      "outbreak",
      "points:lio:1",
      "mod:sae:+1",
      "triggerSet:turnEnd",
      "points:sae:3",
      "points:lio:2",
      "points:sae:3",
      "triggerFired:turnEnd",
      "points:lio:1",
    ],
  },
  {
    it: "when LIO says yes and SAE says yes",
    yes: { lio: true, sae: true },
    story: ["outbreak", "points:lio:1", "points:sae:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
