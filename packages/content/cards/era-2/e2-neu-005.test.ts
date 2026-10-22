// e2-neu-005 Oil at $147: one test for each way its effect can play out.
// Riding the spike draws from the deck of the side that played the card: on 3 or more SAE scores 2 and takes
// -1 Ops; otherwise the price collapses and SAE takes -1 Ops only.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-neu-005", "Oil at $147", [
  {
    it: "when SAE says no and the draw is 3",
    yes: { sae: false },
    draw: 3,
    story: `
      oil spike
      draw:lio:3
      points:sae:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when SAE says no and the draw is 2: the price collapses",
    yes: { sae: false },
    draw: 2,
    story: `
      oil spike
      draw:lio:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      oil spike
      points:sae:1
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE plays it and says no, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { sae: false },
    draw: 3,
    story: `
      points:lio:2
      oil spike
      draw:sae:3
      points:sae:2
      mod:sae:-1:min1
      points:lio:2
      points:sae:1
    `,
  },
]);
