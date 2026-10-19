// e1-lio-005 NAFTA and the WTO: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-005", "NAFTA and the WTO", [
  {
    it: "plays out as its text says",
    story: `
      trade order
      points:lio:2
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
