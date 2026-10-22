// e3-lio-014 Defence of Kyiv: one test for each way its effect can play out.
import { describeOnceOnly } from "../../src/test/cardEnds.ts";
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-014", "Defence of Kyiv", [
  {
    it: "plays out as its text says",
    story: `
      the capital holds
      points:lio:2
      mod:sae:-1:min1
      triggerSet:turnEnd
      points:sae:1
      points:lio:2
      points:sae:1
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "when SAE plays it for points, SAE's points do not count 1 less",
    rival: "points",
    story: `
      the capital holds
      points:lio:2
      triggerSet:turnEnd
      points:sae:4
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "when SAE picks it as its opening card, SAE's points do not count 1 less",
    rival: "opening",
    story: `
      the capital holds
      points:lio:2
      triggerSet:turnEnd
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
]);

describeOnceOnly("e3-lio-014", "Defence of Kyiv");
