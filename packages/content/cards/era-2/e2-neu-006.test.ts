// e2-neu-006 Natanz Revealed: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-006", "Natanz Revealed", [
  {
    it: "plays out as its text says",
    story: `
      programme revealed
      points:sae:1
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
]);
