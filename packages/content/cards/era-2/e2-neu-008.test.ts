// e2-neu-008 Sovereign Wealth Funds: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-008", "Sovereign Wealth Funds", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["petro-dollars", "points:lio:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: [
      "petro-dollars",
      "points:lio:2",
      "triggerSet:turnEnd",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
      "triggerFired:turnEnd",
      "points:sae:1",
    ],
  },
]);
