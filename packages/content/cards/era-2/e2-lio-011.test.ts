// e2-lio-011 Cedar Revolution: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-011", "Cedar Revolution", [
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: ["troops out", "points:lio:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when SAE says yes and LIO draws 3",
    yes: { sae: true },
    draw: 3,
    story: ["troops out", "draw:lio:3", "points:lio:2", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when SAE says yes and LIO draws 4",
    yes: { sae: true },
    draw: 4,
    story: ["troops out", "draw:lio:4", "points:sae:2", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
