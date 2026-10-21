// e1-neu-003 Ruble Default: one test for each way its effect can play out.
// A default draws from the deck of the side that played the card: on 3 or more SAE scores 2 and takes -1 Ops;
// otherwise the reset fails and SAE takes -1 Ops only.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-003", "Ruble Default", [
  {
    it: "when SAE says yes and the draw is 3",
    yes: { sae: true },
    draw: 3,
    story: `
      default
      draw:lio:3
      points:sae:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when SAE says yes and the draw is 2: the reset fails",
    yes: { sae: true },
    draw: 2,
    story: `
      default
      draw:lio:2
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      default
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE plays it and says yes, the draw is from SAE's deck",
    playedBy: "sae",
    yes: { sae: true },
    draw: 3,
    story: `
      points:lio:2
      default
      draw:sae:3
      points:sae:2
      mod:sae:-1:min1
      points:lio:2
      points:sae:1
    `,
  },
]);
