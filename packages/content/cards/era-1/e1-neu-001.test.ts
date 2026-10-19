// e1-neu-001 Rwandan Genocide: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-001", "Rwandan Genocide", [
  {
    it: "plays out as its text says",
    story: `
      the world looks away
      mod:both:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
]);
