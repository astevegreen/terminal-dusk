// e1-sae-009 Belgrade Embassy Bombing: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-009", "Belgrade Embassy Bombing", [
  {
    it: "when SAE draws 2",
    draw: 2,
    story: `
      points:lio:2
      embassy hit
      draw:sae:2
      points:lio:1
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE draws 3",
    draw: 3,
    story: `
      points:lio:2
      embassy hit
      draw:sae:3
      points:sae:3
      points:lio:2
      points:sae:2
    `,
  },
]);
