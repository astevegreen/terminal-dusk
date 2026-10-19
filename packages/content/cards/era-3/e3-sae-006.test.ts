// e3-sae-006 Sandworm: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-006", "Sandworm", [
  {
    it: "when SAE draws 1",
    draw: 1,
    story: `
      points:lio:2
      draw:sae:1
      spillover
      points:sae:1
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
      draw:sae:3
      grid down
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
