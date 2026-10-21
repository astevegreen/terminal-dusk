// e1-sae-002 Handover of Hong Kong: one test for each way its effect can play out.
import { describeOnceOnly } from "../../src/test/cardEnds.ts";
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-sae-002", "Handover of Hong Kong", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      one country, two systems
      points:sae:3
      points:lio:2
      points:sae:2
    `,
  },
]);

describeOnceOnly("e1-sae-002", "Handover of Hong Kong");
