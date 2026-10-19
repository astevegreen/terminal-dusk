// e3-sae-001 Global Financial Crisis: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-001", "Global Financial Crisis", [
  {
    it: "plays out as its text says",
    story: ["points:lio:2", "credit crunch", "mod:both:-1:min1", "points:sae:1", "points:lio:1", "points:sae:1"],
  },
]);
