// e1-sae-003 Golden Shield: one test for each way its effect can play out.
// SAE scores 1 now, then 1 after each later card LIO plays this turn; SAE's own later plays do not score.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-003", "Golden Shield", [
  {
    it: "plays out as its text says: a later LIO play scores and a later SAE play does not",
    story: `
      points:lio:2
      walled network
      points:sae:1
      triggerSet:cardPlayed
      points:lio:2
      triggerFired:cardPlayed
      points:sae:1
      points:sae:2
    `,
  },
]);
