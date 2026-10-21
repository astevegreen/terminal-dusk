// e1-neu-008 Kyoto Protocol: one test for each way its effect can play out.
// Each side chooses, then one draw from the deck of the side that played the card: on 3 or more each side that
// committed scores 1 and takes -1 Ops; otherwise ratification stalls and it takes -1 Ops only.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-008", "Kyoto Protocol", [
  {
    it: "when LIO says yes and SAE says yes and the draw is 3: the commitments hold",
    yes: { lio: true, sae: true },
    draw: 3,
    story: `
      targets set
      draw:lio:3
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
    it: "when LIO says yes and SAE says yes and the draw is 2: ratification stalls",
    yes: { lio: true, sae: true },
    draw: 2,
    story: `
      targets set
      draw:lio:2
      mod:lio:-1:min1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
  {
    it: "when LIO says yes and SAE says no and the draw is 3: the commitments hold",
    yes: { lio: true, sae: false },
    draw: 3,
    story: `
      targets set
      draw:lio:3
      points:lio:1
      mod:lio:-1:min1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes and SAE says no and the draw is 2: ratification stalls",
    yes: { lio: true, sae: false },
    draw: 2,
    story: `
      targets set
      draw:lio:2
      mod:lio:-1:min1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
  {
    it: "when LIO says no and SAE says yes and the draw is 3: the commitments hold",
    yes: { lio: false, sae: true },
    draw: 3,
    story: `
      targets set
      draw:lio:3
      points:sae:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when LIO says no and SAE says yes and the draw is 2: ratification stalls",
    yes: { lio: false, sae: true },
    draw: 2,
    story: `
      targets set
      draw:lio:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when LIO says no and SAE says no and the draw is 3",
    yes: { lio: false, sae: false },
    draw: 3,
    story: `
      targets set
      draw:lio:3
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says no and SAE says no and the draw is 2",
    yes: { lio: false, sae: false },
    draw: 2,
    story: `
      targets set
      draw:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE plays it, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { lio: true, sae: true },
    draw: 3,
    story: `
      points:lio:2
      targets set
      draw:sae:3
      points:lio:1
      mod:lio:-1:min1
      points:sae:1
      mod:sae:-1:min1
      points:lio:1
      points:sae:1
    `,
  },
]);
