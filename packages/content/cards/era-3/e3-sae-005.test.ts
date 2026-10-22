// e3-sae-005 The Leaks: one test for each way its effect can play out.
// LIO's hand is shown to SAE, then SAE scores 1 after each later card LIO plays this turn; SAE's own later plays
// do not score.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-005", "The Leaks", [
  {
    it: "plays out as its text says: LIO's hand is shown, a later LIO play scores and a later SAE play does not",
    story: `
      points:lio:2
      surveillance exposed
      reveal:lio
      triggerSet:cardPlayed
      points:lio:2
      triggerFired:cardPlayed
      points:sae:1
      points:sae:2
    `,
  },
]);
