// e3-lio-004 Iran: SWIFT Cutoff and the Deal: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-004", "Iran: SWIFT Cutoff and the Deal", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      disconnected
      points:lio:2
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      disconnected
      points:lio:2
      deal signed
      points:lio:2
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
