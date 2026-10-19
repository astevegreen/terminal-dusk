// e3-sae-012 Hypersonics on Parade: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-012", "Hypersonics on Parade", [
  {
    it: "when SAE draws 1",
    draw: 1,
    story: ["points:lio:2", "new missiles", "draw:sae:1", "points:lio:1", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when SAE draws 3",
    draw: 3,
    story: ["points:lio:2", "new missiles", "draw:sae:3", "points:sae:1", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when SAE draws 4",
    draw: 4,
    story: ["points:lio:2", "new missiles", "draw:sae:4", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
