// e3-neu-005 Populist Wave: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-005", "Populist Wave", [
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      ballot shock
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      ballot shock
      points:sae:1
      mod:lio:-1:min1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
]);
