// e2-lio-008 Smartphones and Social Networks: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-008", "Smartphones and Social Networks", [
  {
    it: "plays out as its text says",
    story: `
      everyone is connected
      points:lio:1
      mod:both:+1
      points:sae:3
      points:lio:3
      points:sae:3
    `,
  },
]);
