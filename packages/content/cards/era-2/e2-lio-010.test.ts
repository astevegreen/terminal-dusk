// e2-lio-010 PEPFAR: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-010", "PEPFAR", [
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      clinics open
      points:lio:1
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
      clinics open
      points:lio:1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
]);
