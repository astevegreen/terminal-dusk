// e3-lio-015 Revolution of Dignity: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-015", "Revolution of Dignity", [
  {
    it: "when SAE does not stir unrest, only LIO's 2 points happen",
    yes: { sae: false },
    story: `
      turned west
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE stirs unrest and draws 3, LIO spends 1",
    yes: { sae: true },
    draw: 3,
    story: `
      turned west
      points:lio:2
      draw:sae:3
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE stirs unrest and draws 4, SAE spends 1",
    yes: { sae: true },
    draw: 4,
    story: `
      turned west
      points:lio:2
      draw:sae:4
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
