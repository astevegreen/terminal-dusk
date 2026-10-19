// e1-neu-002 Asian Financial Crisis: one test for each way its effect can play out.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard(
  "e1-neu-002",
  "Asian Financial Crisis",
  bothSidesAsked({
    yesYes: `
      contagion
      points:lio:2
      mod:lio:-1:min1
      points:sae:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
    yesNo: `
      contagion
      points:lio:2
      mod:lio:-1:min1
      triggerSet:turnEnd
      points:sae:2
      points:lio:1
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
    noYes: `
      contagion
      triggerSet:turnEnd
      points:sae:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
      triggerFired:turnEnd
      points:sae:1
    `,
    noNo: `
      contagion
      triggerSet:turnEnd
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      triggerFired:turnEnd
      points:sae:1
      points:lio:1
    `,
  }),
);
