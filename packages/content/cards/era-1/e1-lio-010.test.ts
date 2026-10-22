// e1-lio-010 Arrest of Aldrich Ames: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-010", "Arrest of Aldrich Ames", [
  {
    it: "when LIO draws 3",
    draw: 3,
    story: `
      mole exposed
      points:lio:1
      reveal:sae
      draw:lio:3
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO draws 4",
    draw: 4,
    story: `
      mole exposed
      points:lio:1
      reveal:sae
      draw:lio:4
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
