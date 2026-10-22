// e2-sae-003 Olympic Summer 2008: one test for each way its effect can play out.
import { describeOnceOnly } from "../../src/test/cardEnds.ts";
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-003", "Olympic Summer 2008", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      summer of 2008
      points:sae:3
      mod:sae:+1
      points:lio:2
      points:sae:3
    `,
  },
  {
    it: "when LIO plays it for points: SAE 3 only, no SAE +1 Ops",
    rival: "points",
    story: `
      summer of 2008
      points:sae:3
      points:lio:4
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO picks it as its opening card: SAE 3 only, no SAE +1 Ops",
    rival: "opening",
    story: `
      summer of 2008
      points:sae:3
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);

describeOnceOnly("e2-sae-003", "Olympic Summer 2008");
