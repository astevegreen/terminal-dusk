// e2-neu-001 China Joins the WTO: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-001", "China Joins the WTO", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["open trade", "points:lio:1", "points:sae:2", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: [
      "open trade",
      "points:lio:1",
      "points:sae:2",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ],
  },
]);
