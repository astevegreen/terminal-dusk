// ef-sae-002 Cable Cut in the Baltic: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("ef-sae-002", "Cable Cut in the Baltic", [
  {
    it: "plays out as its text says",
    story: ["points:lio:2", "anchor dragged", "mod:lio:-1:min1", "points:lio:1", "points:sae:2"],
  },
]);
