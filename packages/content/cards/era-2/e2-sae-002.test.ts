// e2-sae-002 Curveball: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-002", "Curveball", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      points:lio:2
      points:lio:1
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes and LIO draws 5",
    yes: { lio: true },
    draw: 5,
    story: `
      points:lio:2
      draw:lio:5
      points:lio:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes and LIO draws 4",
    yes: { lio: true },
    draw: 4,
    story: `
      points:lio:2
      draw:lio:4
      intelligence discredited
      points:sae:1
      mod:lio:-1:min1
      points:lio:1
      points:sae:2
    `,
  },
]);
