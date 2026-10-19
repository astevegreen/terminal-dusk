// e1-neu-004 Test Ban Treaty: one test for each way its effect can play out.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard(
  "e1-neu-004",
  "Test Ban Treaty",
  bothSidesAsked({
    yesYes: `
      treaty in force
      points:lio:2
      points:sae:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
    yesNo: `
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
    noYes: `
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
    noNo: `
      treaty stalled
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  }),
);
