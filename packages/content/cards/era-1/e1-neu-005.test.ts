// e1-neu-005 Pokhran and Chagai: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-005", "Pokhran and Chagai", [
  {
    it: "plays out as its text says",
    story: ["two new nuclear states", "points:lio:1", "points:sae:1", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
