// e1-sae-010 Hainan Island Incident: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-010", "Hainan Island Incident", [
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: ["points:lio:2", "collision", "points:sae:1", "points:lio:1", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["points:lio:2", "collision", "points:sae:1", "mod:lio:+1", "points:sae:1", "points:lio:3", "points:sae:2"],
  },
]);
