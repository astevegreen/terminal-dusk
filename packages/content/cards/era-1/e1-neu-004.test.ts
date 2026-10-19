// e1-neu-004 Test Ban Treaty: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-004", "Test Ban Treaty", [
  {
    it: "when LIO says yes and SAE says yes",
    yes: { lio: true, sae: true },
    story: ["treaty in force", "points:lio:2", "points:sae:2", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says yes and SAE says no",
    yes: { lio: true, sae: false },
    story: ["points:sae:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says no and SAE says yes",
    yes: { lio: false, sae: true },
    story: ["points:lio:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says no and SAE says no",
    yes: { lio: false, sae: false },
    story: ["treaty stalled", "points:lio:1", "points:sae:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
