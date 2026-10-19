// e2-sae-001 Invasion of Iraq: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-001", "Invasion of Iraq", [
  {
    it: "plays out as its text says",
    story: ["points:lio:2", "coalition fractures", "points:sae:2", "mod:lio:-1:min1", "points:lio:1", "points:sae:2"],
  },
]);
