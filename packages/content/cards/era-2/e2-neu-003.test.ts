// e2-neu-003 SARS: one test for each way its effect can play out.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard(
  "e2-neu-003",
  "SARS",
  bothSidesAsked({
    noNo: `
      outbreak
      mod:lio:+1
      triggerSet:turnEnd
      mod:sae:+1
      triggerSet:turnEnd
      points:sae:3
      points:lio:3
      points:sae:3
      triggerFired:turnEnd
      triggerFired:turnEnd
      points:sae:2
      points:lio:2
    `,
    noYes: `
      outbreak
      mod:lio:+1
      triggerSet:turnEnd
      points:sae:1
      points:sae:2
      points:lio:3
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
    yesNo: `
      outbreak
      points:lio:1
      mod:sae:+1
      triggerSet:turnEnd
      points:sae:3
      points:lio:2
      points:sae:3
      triggerFired:turnEnd
      points:lio:1
    `,
    yesYes: `
      outbreak
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  }),
);
