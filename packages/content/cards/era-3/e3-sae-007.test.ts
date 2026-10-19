// e3-sae-007 Rare Earth Squeeze: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-007", "Rare Earth Squeeze", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: ["points:lio:2", "supply squeezed", "mod:lio:-1:min1", "points:sae:1", "points:lio:1", "points:sae:2"],
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: ["points:lio:2", "supply squeezed", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
