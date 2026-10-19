// e1-neu-003 Ruble Default: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-003", "Ruble Default", [
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: ["default", "points:sae:2", "mod:sae:-1:min1", "points:sae:1", "points:lio:2", "points:sae:1"],
  },
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: ["default", "points:lio:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
