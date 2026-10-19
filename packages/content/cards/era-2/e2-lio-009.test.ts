// e2-lio-009 Ana Montes Unmasked: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-009", "Ana Montes Unmasked", [
  {
    it: "plays out as its text says",
    story: `
      mole exposed
      points:lio:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
]);
