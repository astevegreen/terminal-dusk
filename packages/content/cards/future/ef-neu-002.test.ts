// ef-neu-002 Heat Dome Summer: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("ef-neu-002", "Heat Dome Summer", [
  {
    it: "plays out as its text says",
    story: ["record heat", "mod:both:-1:min1", "points:sae:1", "points:lio:1", "points:sae:1"],
  },
]);
