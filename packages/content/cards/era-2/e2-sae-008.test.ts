// e2-sae-008 Petrocaribe: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-008", "Petrocaribe", [
  {
    it: "plays out as its text says",
    story: [
      "points:lio:2",
      "oil diplomacy",
      "points:sae:2",
      "triggerSet:turnEnd",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:lio:1",
    ],
  },
]);
