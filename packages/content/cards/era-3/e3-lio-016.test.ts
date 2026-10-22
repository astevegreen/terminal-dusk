// e3-lio-016 Fall of the Caliphate: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-016", "Fall of the Caliphate", [
  {
    it: "without proxy war, only LIO's 2 points happen",
    story: `
      caliphate falls
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "after Syrian Intervention recorded proxy war, SAE spends 1 too",
    before: ["e3-sae-008"],
    story: `
      caliphate falls
      points:lio:2
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
