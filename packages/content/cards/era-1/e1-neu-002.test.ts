// e1-neu-002 Asian Financial Crisis: one test for each way its effect can play out.
// Each side chooses, then one draw from the deck of the side that played the card: on 3 or more contagion
// spreads (a side that stood aside gives the rival 1 at turn end); otherwise no turn-end points.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-002", "Asian Financial Crisis", [
  // On 3 or more, contagion spreads.
  ...bothSidesAsked(
    {
      yesYes: `
        contagion
        draw:lio:3
        points:lio:2
        mod:lio:-1:min1
        points:sae:2
        mod:sae:-1:min1
        points:sae:1
        points:lio:1
        points:sae:1
      `,
      yesNo: `
        contagion
        draw:lio:3
        points:lio:2
        mod:lio:-1:min1
        triggerSet:turnEnd
        points:sae:2
        points:lio:1
        points:sae:2
        triggerFired:turnEnd
        points:lio:1
      `,
      noYes: `
        contagion
        draw:lio:3
        triggerSet:turnEnd
        points:sae:2
        mod:sae:-1:min1
        points:sae:1
        points:lio:2
        points:sae:1
        triggerFired:turnEnd
        points:sae:1
      `,
      noNo: `
        contagion
        draw:lio:3
        triggerSet:turnEnd
        triggerSet:turnEnd
        points:sae:2
        points:lio:2
        points:sae:2
        triggerFired:turnEnd
        triggerFired:turnEnd
        points:sae:1
        points:lio:1
      `,
    },
    3,
  ),
  // Otherwise it is contained: no turn-end points.
  ...bothSidesAsked(
    {
      yesYes: `
        contagion
        draw:lio:2
        points:lio:2
        mod:lio:-1:min1
        points:sae:2
        mod:sae:-1:min1
        points:sae:1
        points:lio:1
        points:sae:1
      `,
      yesNo: `
        contagion
        draw:lio:2
        points:lio:2
        mod:lio:-1:min1
        points:sae:2
        points:lio:1
        points:sae:2
      `,
      noYes: `
        contagion
        draw:lio:2
        points:sae:2
        mod:sae:-1:min1
        points:sae:1
        points:lio:2
        points:sae:1
      `,
      noNo: `
        contagion
        draw:lio:2
        points:sae:2
        points:lio:2
        points:sae:2
      `,
    },
    2,
  ),
  {
    it: "when SAE plays it, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { lio: false, sae: false },
    draw: 4,
    story: `
      points:lio:2
      contagion
      draw:sae:4
      triggerSet:turnEnd
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      triggerFired:turnEnd
      points:sae:1
      points:lio:1
    `,
  },
]);
