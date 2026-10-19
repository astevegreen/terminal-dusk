// e1-sae-004 Second Chechen War: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-004", "Second Chechen War", [
  {
    it: "plays out as its text says",
    story: ["points:lio:2", "consolidation", "points:sae:3", "points:lio:2", "points:sae:2"],
  },
]);
