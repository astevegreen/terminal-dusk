// e3-sae-008 Syrian Intervention: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-008", "Syrian Intervention", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      lasting:proxy war
      points:sae:2
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
]);
