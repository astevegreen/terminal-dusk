// e3-neu-009 October 7 and Gaza: one test for each way its effect can play out.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard(
  "e3-neu-009",
  "October 7 and Gaza",
  bothSidesAsked({
    yesYes: `
      the region on edge
      points:lio:1
      mod:lio:-1:min1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
    yesNo: `
      the region on edge
      points:lio:1
      mod:lio:-1:min1
      points:lio:1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
    noYes: `
      the region on edge
      points:sae:1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
    noNo: `
      the region on edge
      points:sae:1
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  }),
);
