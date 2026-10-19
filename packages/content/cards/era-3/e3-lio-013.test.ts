// e3-lio-013 Fall of the Assad Regime: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-013", "Fall of the Assad Regime", [
  {
    it: "plays out as its text says",
    story: ["foothold lost", "points:lio:2", "mod:sae:-1:min1", "points:sae:1", "points:lio:2", "points:sae:1"],
  },
]);
