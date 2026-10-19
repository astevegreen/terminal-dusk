// e3-lio-012 Salisbury and the Sleuths: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-012", "Salisbury and the Sleuths", [
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      nerve agent
      points:lio:1
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE says yes and LIO draws 1",
    yes: { sae: true },
    draw: 1,
    story: `
      nerve agent
      points:lio:1
      draw:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE says yes and LIO draws 3",
    yes: { sae: true },
    draw: 3,
    story: `
      nerve agent
      points:lio:1
      draw:lio:3
      officers named
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
