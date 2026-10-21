// e3-neu-007 AI Compute Race: one test for each way its effect can play out.
// No choice: LIO 1, SAE 1, then a draw from the deck of the side that played the card: on 4 or more, the controls
// bite: LIO 1 more; otherwise nothing more.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-007", "AI Compute Race", [
  {
    it: "when the draw is 4, the controls bite",
    draw: 4,
    story: `
      compute race
      points:lio:1
      points:sae:1
      draw:lio:4
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when the draw is 3, nothing more",
    draw: 3,
    story: `
      compute race
      points:lio:1
      points:sae:1
      draw:lio:3
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE plays it, the draw is from SAE's deck",
    playedBy: "sae",
    draw: 4,
    story: `
      points:lio:2
      compute race
      points:lio:1
      points:sae:1
      draw:sae:4
      points:lio:1
      points:lio:2
      points:sae:2
    `,
  },
]);
