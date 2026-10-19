// e1-neu-008 Kyoto Protocol: one test for each way its effect can play out.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard(
  "e1-neu-008",
  "Kyoto Protocol",
  bothSidesAsked({
    yesYes: `
      targets set
      points:lio:1
      mod:lio:-1:min1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
    yesNo: `
      targets set
      points:lio:1
      mod:lio:-1:min1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
    noYes: `
      targets set
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
    noNo: `
      targets set
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  }),
);
