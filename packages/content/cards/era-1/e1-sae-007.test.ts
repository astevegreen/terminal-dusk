// e1-sae-007 Taiwan Strait Crisis: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-007", "Taiwan Strait Crisis", [
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      points:lio:2
      strait crisis
      points:lio:2
      mod:lio:-1:min1
      points:lio:1
      points:sae:2
    `,
  },
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      points:lio:2
      strait crisis
      points:sae:3
      points:lio:2
      points:sae:2
    `,
  },
]);
