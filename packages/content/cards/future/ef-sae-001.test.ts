// ef-sae-001 Shadow Fleet: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("ef-sae-001", "Shadow Fleet", [
  {
    it: "when SAE draws 1",
    draw: 1,
    story: `
      points:lio:2
      draw:sae:1
      tanker seized
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
      sanctions evaded
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
