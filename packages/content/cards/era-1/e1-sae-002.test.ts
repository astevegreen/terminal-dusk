// e1-sae-002 Handover of Hong Kong: one test for each way its effect can play out.
import { describeOnceOnly } from "../../src/test/cardEnds.ts";
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-002", "Handover of Hong Kong", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      lasting:one country, two systems
      points:sae:3
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO plays it for points: the tag is still recorded and SAE spends 2 instead of 3",
    rival: "points",
    story: `
      lasting:one country, two systems
      points:sae:2
      points:lio:4
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO picks it as its opening card: the tag is still recorded and SAE spends 2 instead of 3",
    rival: "opening",
    story: `
      lasting:one country, two systems
      points:sae:2
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);

describeOnceOnly("e1-sae-002", "Handover of Hong Kong");
