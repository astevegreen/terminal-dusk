// e3-lio-001 Stuxnet: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-001", "Stuxnet", [
  {
    it: "when LIO draws 1",
    draw: 1,
    story: `
      draw:lio:1
      cyberweapon loose
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO draws 3",
    draw: 3,
    story: `
      draw:lio:3
      centrifuges spin apart
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
