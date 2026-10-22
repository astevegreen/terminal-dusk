// e3-neu-001 Arab Spring: one test for each way its effect can play out.
// Each side chooses; then one draw for each side that backs the protesters (LIO's first, dLio then dSae), each from
// the deck of the side that played the card: on 3 or more, that side 1 and -1 Ops; otherwise the uprising stalls:
// that side -1 Ops only. If exactly one side backs them, the other scores 1 at turn end, whatever the draw gives.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-001", "Arab Spring", [
  {
    it: "when LIO says no and SAE says no, there is no draw",
    yes: { lio: false, sae: false },
    story: `
      the square
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says no and SAE says yes and SAE's draw is 3",
    yes: { lio: false, sae: true },
    draws: [3],
    story: `
      the square
      draw:lio:3
      points:sae:1
      mod:sae:-1:min1
      triggerSet:turnEnd
      points:sae:1
      points:lio:2
      points:sae:1
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "when LIO says no and SAE says yes and SAE's draw is 2, the uprising stalls",
    yes: { lio: false, sae: true },
    draws: [2],
    story: `
      the square
      draw:lio:2
      mod:sae:-1:min1
      triggerSet:turnEnd
      points:sae:1
      points:lio:2
      points:sae:1
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "when LIO says yes and SAE says no and LIO's draw is 3",
    yes: { lio: true, sae: false },
    draws: [3],
    story: `
      the square
      draw:lio:3
      points:lio:1
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
    it: "when LIO says yes and SAE says no and LIO's draw is 2, the uprising stalls",
    yes: { lio: true, sae: false },
    draws: [2],
    story: `
      the square
      draw:lio:2
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
    it: "when both say yes and both draws are 3",
    yes: { lio: true, sae: true },
    draws: [3, 3],
    story: `
      the square
      draw:lio:3
      points:lio:1
      mod:lio:-1:min1
      draw:lio:3
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
  {
    it: "when both say yes and both draws are 2",
    yes: { lio: true, sae: true },
    draws: [2, 2],
    story: `
      the square
      draw:lio:2
      mod:lio:-1:min1
      draw:lio:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
  {
    it: "when both say yes, LIO's draw is 5 and SAE's draw is 2",
    yes: { lio: true, sae: true },
    draws: [5, 2],
    story: `
      the square
      draw:lio:5
      points:lio:1
      mod:lio:-1:min1
      draw:lio:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
  {
    it: "when both say yes, LIO's draw is 1 and SAE's draw is 4",
    yes: { lio: true, sae: true },
    draws: [1, 4],
    story: `
      the square
      draw:lio:1
      mod:lio:-1:min1
      draw:lio:4
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
  {
    it: "when SAE plays it, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { lio: true, sae: false },
    draws: [4],
    story: `
      points:lio:2
      the square
      draw:sae:4
      points:lio:1
      mod:lio:-1:min1
      triggerSet:turnEnd
      points:lio:1
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
]);
