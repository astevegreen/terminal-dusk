// ef-neu-001 Open-Weight Model Leak: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("ef-neu-001", "Open-Weight Model Leak", [
  {
    it: "plays out as its text says",
    story: `
      weights everywhere
      mod:both:+1
      points:sae:3
      points:lio:3
      points:sae:3
    `,
  },
]);
