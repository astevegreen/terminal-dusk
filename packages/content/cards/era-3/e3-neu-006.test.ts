// e3-neu-006 Arms Control Unravels: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-006", "Arms Control Unravels", [
  {
    it: "plays out as its text says",
    story: `
      treaties lapse
      mod:both:+1
      points:sae:3
      points:lio:3
      points:sae:3
    `,
  },
]);
