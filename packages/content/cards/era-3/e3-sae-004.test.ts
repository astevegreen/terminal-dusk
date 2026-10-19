// e3-sae-004 Full-Scale Invasion: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-004", "Full-Scale Invasion", [
  {
    it: "plays out as its text says",
    story: [
      "points:lio:2",
      "full-scale war",
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
