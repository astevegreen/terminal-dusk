// e2-lio-004 ABM Treaty Withdrawal: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-004", "ABM Treaty Withdrawal", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["points:lio:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: ["treaty gone", "points:lio:2", "points:sae:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
