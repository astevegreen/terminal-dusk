// e1-sae-005 The Hanssen Leak: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-005", "The Hanssen Leak", [
  {
    it: "when SAE draws 2",
    draw: 2,
    story: [
      "points:lio:2",
      "mole inside",
      "points:sae:2",
      "draw:sae:2",
      "mole caught",
      "points:lio:1",
      "points:lio:2",
      "points:sae:2",
    ],
  },
  {
    it: "when SAE draws 3",
    draw: 3,
    story: ["points:lio:2", "mole inside", "points:sae:2", "draw:sae:3", "points:lio:2", "points:sae:2"],
  },
]);
