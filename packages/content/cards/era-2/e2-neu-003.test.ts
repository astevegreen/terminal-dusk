// e2-neu-003 SARS: one test for each way its effect can play out.
// Each side that hides the outbreak gets +1 Ops, then one draw (LIO's first), each from the deck of the side that
// played the card: on 3 or more it leaks and the rival scores 1 at turn end; otherwise it stays hidden.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-003", "SARS", [
  {
    it: "when both hide it and both draws are 3: both leak, each leak point counts 2",
    yes: { lio: false, sae: false },
    draws: [3, 3],
    story: `
      outbreak
      mod:lio:+1
      draw:lio:3
      triggerSet:turnEnd
      mod:sae:+1
      draw:lio:3
      triggerSet:turnEnd
      points:sae:3
      points:lio:3
      points:sae:3
      triggerFired:turnEnd
      triggerFired:turnEnd
      points:sae:2
      points:lio:2
    `,
  },
  {
    it: "when both hide it and the draws are 3 then 2: only LIO's leaks",
    yes: { lio: false, sae: false },
    draws: [3, 2],
    story: `
      outbreak
      mod:lio:+1
      draw:lio:3
      triggerSet:turnEnd
      mod:sae:+1
      draw:lio:2
      points:sae:3
      points:lio:3
      points:sae:3
      triggerFired:turnEnd
      points:sae:2
    `,
  },
  {
    it: "when both hide it and the draws are 2 then 3: only SAE's leaks",
    yes: { lio: false, sae: false },
    draws: [2, 3],
    story: `
      outbreak
      mod:lio:+1
      draw:lio:2
      mod:sae:+1
      draw:lio:3
      triggerSet:turnEnd
      points:sae:3
      points:lio:3
      points:sae:3
      triggerFired:turnEnd
      points:lio:2
    `,
  },
  {
    it: "when both hide it and both draws are 2: it stays hidden, no leak point",
    yes: { lio: false, sae: false },
    draws: [2, 2],
    story: `
      outbreak
      mod:lio:+1
      draw:lio:2
      mod:sae:+1
      draw:lio:2
      points:sae:3
      points:lio:3
      points:sae:3
    `,
  },
  {
    it: "when LIO hides it, SAE reports, and the draw is 3: it leaks",
    yes: { lio: false, sae: true },
    draw: 3,
    story: `
      outbreak
      mod:lio:+1
      draw:lio:3
      triggerSet:turnEnd
      points:sae:1
      points:sae:2
      points:lio:3
      points:sae:2
      triggerFired:turnEnd
      points:sae:1
    `,
  },
  {
    it: "when LIO hides it, SAE reports, and the draw is 2: it stays hidden",
    yes: { lio: false, sae: true },
    draw: 2,
    story: `
      outbreak
      mod:lio:+1
      draw:lio:2
      points:sae:1
      points:sae:2
      points:lio:3
      points:sae:2
    `,
  },
  {
    it: "when LIO reports, SAE hides it, and the draw is 3: it leaks",
    yes: { lio: true, sae: false },
    draw: 3,
    story: `
      outbreak
      points:lio:1
      mod:sae:+1
      draw:lio:3
      triggerSet:turnEnd
      points:sae:3
      points:lio:2
      points:sae:3
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "when LIO reports, SAE hides it, and the draw is 2: it stays hidden",
    yes: { lio: true, sae: false },
    draw: 2,
    story: `
      outbreak
      points:lio:1
      mod:sae:+1
      draw:lio:2
      points:sae:3
      points:lio:2
      points:sae:3
    `,
  },
  {
    it: "when LIO says yes and SAE says yes",
    yes: { lio: true, sae: true },
    story: `
      outbreak
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE plays it and both hide it, both draws are from SAE's deck",
    playedBy: "sae",
    yes: { lio: false, sae: false },
    draws: [3, 3],
    story: `
      points:lio:2
      outbreak
      mod:lio:+1
      draw:sae:3
      triggerSet:turnEnd
      mod:sae:+1
      draw:sae:3
      triggerSet:turnEnd
      points:lio:3
      points:sae:3
      triggerFired:turnEnd
      triggerFired:turnEnd
      points:sae:2
      points:lio:2
    `,
  },
]);
