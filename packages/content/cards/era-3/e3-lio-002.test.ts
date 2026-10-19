// e3-lio-002 Neptune Spear: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-002", "Neptune Spear", [
  {
    it: "when LIO draws 1",
    draw: 1,
    story: ["draw:lio:1", "raid fails", "points:sae:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
  {
    it: "when LIO draws 2",
    draw: 2,
    story: ["draw:lio:2", "raid succeeds", "points:lio:2", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
