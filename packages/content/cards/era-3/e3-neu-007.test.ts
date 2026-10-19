// e3-neu-007 AI Compute Race: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-007", "AI Compute Race", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      compute race
      points:lio:1
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
      compute race
      points:lio:1
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
