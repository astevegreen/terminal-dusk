// e1-lio-004 NATO Enlargement 1999: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-004", "NATO Enlargement 1999", [
  {
    it: "when SAE says yes and LIO draws 3",
    yes: { sae: true },
    draw: 3,
    story: [
      "enlargement",
      "points:lio:2",
      "draw:lio:3",
      "points:sae:2",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ],
  },
  {
    it: "when SAE says yes and LIO draws 4",
    yes: { sae: true },
    draw: 4,
    story: [
      "enlargement",
      "points:lio:2",
      "draw:lio:4",
      "points:lio:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ],
  },
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: ["enlargement", "points:lio:2", "points:lio:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
