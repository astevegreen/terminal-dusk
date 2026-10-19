// e1-sae-008 Primakov's U-turn: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-008", "Primakov's U-turn", [
  {
    it: "plays out as its text says",
    story: ["points:lio:2", "turn over the Atlantic", "mod:lio:-1:min1", "points:lio:1", "points:sae:2"],
  },
]);
