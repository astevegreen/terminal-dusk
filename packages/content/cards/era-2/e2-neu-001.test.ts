// e2-neu-001 China Joins the WTO: one test for each way its effect can play out.
// Granting permanent normal trade draws from the deck of the side that played the card: on 3 or more LIO 1 and
// SAE 1 more; otherwise SAE 1 more only.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-001", "China Joins the WTO", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      open trade
      points:lio:1
      points:sae:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes and the draw is 3",
    yes: { lio: true },
    draw: 3,
    story: `
      open trade
      points:lio:1
      points:sae:2
      draw:lio:3
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes and the draw is 2: only SAE gains more",
    yes: { lio: true },
    draw: 2,
    story: `
      open trade
      points:lio:1
      points:sae:2
      draw:lio:2
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE plays it and LIO says yes, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { lio: true },
    draw: 3,
    story: `
      points:lio:2
      open trade
      points:lio:1
      points:sae:2
      draw:sae:3
      points:lio:1
      points:sae:1
      points:lio:2
      points:sae:2
    `,
  },
]);
