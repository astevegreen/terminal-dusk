// e1-lio-007 Kosovo Air Campaign: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-007", "Kosovo Air Campaign", [
  {
    it: "plays out as its text says",
    story: `
      intervention without mandate
      points:lio:2
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
