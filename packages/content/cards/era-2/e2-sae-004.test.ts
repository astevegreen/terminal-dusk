// e2-sae-004 Estonian Cyberattacks 2007: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-004", "Estonian Cyberattacks 2007", [
  {
    it: "when SAE draws 2",
    draw: 2,
    story: ["points:lio:2", "draw:sae:2", "cyber defence doctrine", "points:lio:1", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when SAE draws 3",
    draw: 3,
    story: ["points:lio:2", "draw:sae:3", "sites down", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
