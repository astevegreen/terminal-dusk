// e2-lio-014 Fall of the Taliban: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-014", "Fall of the Taliban", [
  {
    it: "when LIO draws 2, the insurgency regroups and SAE spends 1",
    draw: 2,
    story: `
      Kabul taken
      points:lio:2
      draw:lio:2
      insurgency regroups
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO draws 3, a new government takes hold and LIO spends 1 more",
    draw: 3,
    story: `
      Kabul taken
      points:lio:2
      draw:lio:3
      new government
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
