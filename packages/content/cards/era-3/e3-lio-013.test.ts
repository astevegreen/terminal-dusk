// e3-lio-013 Fall of the Assad Regime: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-013", "Fall of the Assad Regime", [
  {
    it: "without proxy war, LIO spends 2 and SAE counts 1 less this turn",
    story: `
      foothold lost
      points:lio:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "after Syrian Intervention recorded proxy war, LIO spends 3 and SAE counts 1 less this turn",
    before: ["e3-sae-008"],
    story: `
      foothold lost
      points:lio:3
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
]);
