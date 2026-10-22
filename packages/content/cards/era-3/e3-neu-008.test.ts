// e3-neu-008 Tariff Shock: one test for each way its effect can play out.
// First a draw from the deck of the side that played the card: on 3 or more, LIO -1 Ops; otherwise the tariffs are
// paused: no LIO penalty. Then SAE chooses: retaliate (SAE 1 and SAE -1 Ops) or hold fire (SAE 1 at turn end).
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-008", "Tariff Shock", [
  {
    it: "when the draw is 3 and SAE says no",
    yes: { sae: false },
    draw: 3,
    story: `
      tariff wall
      draw:lio:3
      mod:lio:-1:min1
      triggerSet:turnEnd
      points:sae:2
      points:lio:1
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
  {
    it: "when the draw is 3 and SAE says yes",
    yes: { sae: true },
    draw: 3,
    story: `
      tariff wall
      draw:lio:3
      mod:lio:-1:min1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
  {
    it: "when the draw is 2 and SAE says no, the tariffs are paused",
    yes: { sae: false },
    draw: 2,
    story: `
      tariff wall
      draw:lio:2
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
  {
    it: "when the draw is 2 and SAE says yes, the tariffs are paused",
    yes: { sae: true },
    draw: 2,
    story: `
      tariff wall
      draw:lio:2
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when SAE plays it, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { sae: true },
    draw: 6,
    story: `
      points:lio:2
      tariff wall
      draw:sae:6
      mod:lio:-1:min1
      points:sae:1
      mod:sae:-1:min1
      points:lio:1
      points:sae:1
    `,
  },
]);
