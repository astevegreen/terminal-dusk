// e3-sae-013 Eurozone Crisis: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-013", "Eurozone Crisis", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      points:lio:2
      troika
      port sold
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      points:lio:2
      troika
      points:lio:1
      mod:lio:-1:min1
      points:lio:1
      points:sae:2
    `,
  },
]);
