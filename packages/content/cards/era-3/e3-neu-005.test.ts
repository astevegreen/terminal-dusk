// e3-neu-005 Populist Wave: one test for each way its effect can play out.
// SAE chooses. Standing back: LIO 1. Amplifying online draws from the deck of the side that played the card: on 3
// or more, SAE 1 and LIO -1 Ops; otherwise the campaign is exposed: LIO 1.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-005", "Populist Wave", [
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      ballot shock
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE says yes and the draw is 3",
    yes: { sae: true },
    draw: 3,
    story: `
      ballot shock
      draw:lio:3
      points:sae:1
      mod:lio:-1:min1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
  {
    it: "when SAE says yes and the draw is 2, the campaign is exposed",
    yes: { sae: true },
    draw: 2,
    story: `
      ballot shock
      draw:lio:2
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE plays it, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { sae: true },
    draw: 5,
    story: `
      points:lio:2
      ballot shock
      draw:sae:5
      points:sae:1
      mod:lio:-1:min1
      points:lio:1
      points:sae:2
    `,
  },
]);
