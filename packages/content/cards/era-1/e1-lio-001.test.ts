// e1-lio-001 Maastricht Treaty: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-001", "Maastricht Treaty", [
  {
    it: "plays out as its text says",
    story: `
      lasting:union founded
      points:lio:1
      mod:lio:+1
      points:sae:2
      points:lio:3
      points:sae:2
    `,
  },
]);
