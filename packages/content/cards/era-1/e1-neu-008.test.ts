// e1-neu-008 Kyoto Protocol: one test for each way its effect can play out.
// Each side chooses, then one draw from the deck of the side that played the card: on 3 or more each side that
// committed scores 1 and takes -1 Ops; otherwise ratification stalls and it takes -1 Ops only.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-008", "Kyoto Protocol", [
  // On 3 or more, the commitments hold.
  ...bothSidesAsked(
    {
      yesYes: `
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
      yesNo: `
        targets set
        draw:lio:3
        points:lio:1
        mod:lio:-1:min1
        points:sae:2
        points:lio:1
        points:sae:2
      `,
      noYes: `
        targets set
        draw:lio:3
        points:sae:1
        mod:sae:-1:min1
        points:sae:1
        points:lio:2
        points:sae:1
      `,
      noNo: `
        targets set
        draw:lio:3
        points:sae:2
        points:lio:2
        points:sae:2
      `,
    },
    3,
  ),
  // Otherwise ratification stalls.
  ...bothSidesAsked(
    {
      yesYes: `
        targets set
        draw:lio:2
        mod:lio:-1:min1
        mod:sae:-1:min1
        points:sae:1
        points:lio:1
        points:sae:1
      `,
      yesNo: `
        targets set
        draw:lio:2
        mod:lio:-1:min1
        points:sae:2
        points:lio:1
        points:sae:2
      `,
      noYes: `
        targets set
        draw:lio:2
        mod:sae:-1:min1
        points:sae:1
        points:lio:2
        points:sae:1
      `,
      noNo: `
        targets set
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
