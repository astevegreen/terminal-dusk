// e2-sae-003 Olympic Summer 2008: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-003", "Olympic Summer 2008", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      summer of 2008
      points:sae:3
      mod:sae:+1
      points:lio:2
      points:sae:3
    `,
  },
]);
