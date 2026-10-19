// ef-lio-002 Undersea Cable Patrols: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("ef-lio-002", "Undersea Cable Patrols", [
  {
    it: "plays out as its text says",
    story: ["cables watched", "mod:sae:-1:min1", "points:sae:1", "points:lio:2", "points:sae:1"],
  },
]);
