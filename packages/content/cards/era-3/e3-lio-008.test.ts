// e3-lio-008 Pre-bunking: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-008", "Pre-bunking", [
  {
    it: "plays out as its text says",
    story: ["pretext denied", "mod:sae:-1:min1", "points:sae:1", "points:lio:2", "points:sae:1"],
  },
]);
