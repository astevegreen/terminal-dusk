// e1-lio-006 Desert Storm Coalition: one test for each way its effect can play out.
import { describeOnceOnly } from "../../src/test/cardEnds.ts";
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-006", "Desert Storm Coalition", [
  {
    it: "plays out as its text says",
    story: `
      coalition victory
      points:lio:3
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "when SAE plays it for points: LIO 3 only, no SAE -1 Ops",
    rival: "points",
    story: `
      coalition victory
      points:lio:3
      points:sae:4
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE picks it as its opening card: LIO 3 only, no SAE -1 Ops",
    rival: "opening",
    story: `
      coalition victory
      points:lio:3
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);

describeOnceOnly("e1-lio-006", "Desert Storm Coalition");
