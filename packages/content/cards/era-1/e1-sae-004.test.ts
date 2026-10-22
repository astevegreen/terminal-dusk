// e1-sae-004 Second Chechen War: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-004", "Second Chechen War", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      consolidation
      points:sae:3
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO plays it for points: SAE spends 2 instead of 3",
    rival: "points",
    story: `
      consolidation
      points:sae:2
      points:lio:3
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO picks it as its opening card: SAE spends 2 instead of 3",
    rival: "opening",
    story: `
      consolidation
      points:sae:2
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
