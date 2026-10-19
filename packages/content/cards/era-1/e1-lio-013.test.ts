// e1-lio-013 Oslo Accords: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-013", "Oslo Accords", [
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      handshake
      points:lio:1
      points:sae:1
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      handshake
      points:lio:1
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
