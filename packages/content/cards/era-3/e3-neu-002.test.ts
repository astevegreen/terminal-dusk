// e3-neu-002 COVID-19: one test for each way its effect can play out.
// Each side chooses. Closing the borders: that side 1 and -1 Ops. Keeping them open: a draw for that side (LIO's
// first, dLio then dSae), from the deck of the side that played the card: on 3 or more, that side 2 and the rival 1;
// otherwise the outbreak hits home: the rival 1 only.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-neu-002", "COVID-19", [
  {
    it: "when LIO says yes and SAE says yes, there is no draw",
    yes: { lio: true, sae: true },
    story: `
      pandemic
      points:lio:1
      mod:lio:-1:min1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
  {
    it: "when LIO says yes and SAE says no and SAE's draw is 3",
    yes: { lio: true, sae: false },
    draws: [3],
    story: `
      pandemic
      points:lio:1
      mod:lio:-1:min1
      draw:lio:3
      points:sae:2
      points:lio:1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes and SAE says no and SAE's draw is 2, the outbreak hits home",
    yes: { lio: true, sae: false },
    draws: [2],
    story: `
      pandemic
      points:lio:1
      mod:lio:-1:min1
      draw:lio:2
      points:lio:1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
  {
    it: "when LIO says no and SAE says yes and LIO's draw is 3",
    yes: { lio: false, sae: true },
    draws: [3],
    story: `
      pandemic
      draw:lio:3
      points:lio:2
      points:sae:1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when LIO says no and SAE says yes and LIO's draw is 2, the outbreak hits home",
    yes: { lio: false, sae: true },
    draws: [2],
    story: `
      pandemic
      draw:lio:2
      points:sae:1
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when both say no and both draws are 3",
    yes: { lio: false, sae: false },
    draws: [3, 3],
    story: `
      pandemic
      draw:lio:3
      points:lio:2
      points:sae:1
      draw:lio:3
      points:sae:2
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when both say no and both draws are 2",
    yes: { lio: false, sae: false },
    draws: [2, 2],
    story: `
      pandemic
      draw:lio:2
      points:sae:1
      draw:lio:2
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when both say no, LIO's draw is 5 and SAE's draw is 2",
    yes: { lio: false, sae: false },
    draws: [5, 2],
    story: `
      pandemic
      draw:lio:5
      points:lio:2
      points:sae:1
      draw:lio:2
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when both say no, LIO's draw is 1 and SAE's draw is 4",
    yes: { lio: false, sae: false },
    draws: [1, 4],
    story: `
      pandemic
      draw:lio:1
      points:sae:1
      draw:lio:4
      points:sae:2
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE plays it, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { lio: false, sae: true },
    draws: [4],
    story: `
      points:lio:2
      pandemic
      draw:sae:4
      points:lio:2
      points:sae:1
      points:sae:1
      mod:sae:-1:min1
      points:lio:2
      points:sae:1
    `,
  },
]);
