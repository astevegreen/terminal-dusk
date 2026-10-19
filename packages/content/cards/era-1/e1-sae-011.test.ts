// e1-sae-011 Pristina Airport Dash: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-011", "Pristina Airport Dash", [
  {
    it: "when LIO says yes and SAE draws 3",
    yes: { lio: true },
    draw: 3,
    story: [
      "points:lio:2",
      "airport seized",
      "points:sae:1",
      "draw:sae:3",
      "points:lio:2",
      "points:lio:2",
      "points:sae:2",
    ],
  },
  {
    it: "when LIO says yes and SAE draws 4",
    yes: { lio: true },
    draw: 4,
    story: [
      "points:lio:2",
      "airport seized",
      "points:sae:1",
      "draw:sae:4",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ],
  },
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["points:lio:2", "airport seized", "points:sae:1", "stand-off avoided", "points:lio:2", "points:sae:2"],
  },
]);
