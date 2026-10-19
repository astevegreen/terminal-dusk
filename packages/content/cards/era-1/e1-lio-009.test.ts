// e1-lio-009 Peso Bailout: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-009", "Peso Bailout", [
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      rescue
      points:lio:2
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      rescue
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
