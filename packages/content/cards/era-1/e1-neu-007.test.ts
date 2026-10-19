// e1-neu-007 First Crew on the ISS: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-007", "First Crew on the ISS", [
  {
    it: "plays out as its text says",
    story: `
      crew aboard
      mod:both:+1
      points:sae:3
      points:lio:3
      points:sae:3
    `,
  },
]);
