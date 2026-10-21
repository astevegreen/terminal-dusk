// e2-neu-008 Sovereign Wealth Funds: one test for each way its effect can play out.
// Letting them buy in draws from the deck of the side that played the card: on 3 or more LIO 2 now; otherwise the
// stakes sour and LIO 1 now. Either way SAE 1 at turn end.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-008", "Sovereign Wealth Funds", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      petro-dollars
      points:lio:1
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
      petro-dollars
      draw:lio:3
      points:lio:2
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
  {
    it: "when LIO says yes and the draw is 2: the stakes sour",
    yes: { lio: true },
    draw: 2,
    story: `
      petro-dollars
      draw:lio:2
      points:lio:1
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
  {
    it: "when SAE plays it and LIO says yes, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { lio: true },
    draw: 3,
    story: `
      points:lio:2
      petro-dollars
      draw:sae:3
      points:lio:2
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
]);
