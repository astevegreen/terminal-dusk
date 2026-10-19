// e2-lio-006 Libya Disarms: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-006", "Libya Disarms", [
  {
    it: "plays out as its text says",
    story: `
      programme surrendered
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
