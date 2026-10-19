// e3-neu-001 Arab Spring: one test for each way its effect can play out.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard(
  "e3-neu-001",
  "Arab Spring",
  bothSidesAsked({
    noNo: `
      the square
      points:sae:2
      points:lio:2
      points:sae:2
    `,
    noYes: `
      the square
      points:sae:1
      mod:sae:-1:min1
      triggerSet:turnEnd
      points:sae:1
      points:lio:2
      points:sae:1
      triggerFired:turnEnd
      points:lio:1
    `,
    yesNo: `
      the square
      points:lio:1
      mod:lio:-1:min1
      triggerSet:turnEnd
      points:sae:2
      points:lio:1
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
    yesYes: `
      the square
      points:lio:1
      mod:lio:-1:min1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  }),
);
