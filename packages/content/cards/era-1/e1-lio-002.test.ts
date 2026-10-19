// e1-lio-002 Budapest Memorandum: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-002", "Budapest Memorandum", [
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      assurances given
      points:lio:2
      promise kept
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      assurances given
      points:lio:2
      hollow assurance
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
