// e2-neu-005 Oil at $147: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-005", "Oil at $147", [
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      oil spike
      points:sae:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      oil spike
      points:sae:1
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
