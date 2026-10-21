// e2-neu-007 Kosovo Declares Independence: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-007", "Kosovo Declares Independence", [
  {
    it: "plays out as its text says",
    story: `
      lasting:precedent set
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
