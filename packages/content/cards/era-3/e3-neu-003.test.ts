// e3-neu-003 Paris Agreement: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-003", "Paris Agreement", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      pledges
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      pledges
      points:lio:1
      mod:lio:-1:min1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
]);
