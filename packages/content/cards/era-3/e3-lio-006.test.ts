// e3-lio-006 Chip Chokepoint: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-006", "Chip Chokepoint", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["points:lio:2", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says yes and LIO draws 1",
    yes: { lio: true },
    draw: 1,
    story: ["draw:lio:1", "controls leak", "points:lio:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO says yes and LIO draws 3",
    yes: { lio: true },
    draw: 3,
    story: ["draw:lio:3", "chokepoint sealed", "points:lio:3", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
