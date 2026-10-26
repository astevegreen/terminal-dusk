// e2-lio-006 Libya Disarms: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-006", "Libya Disarms", [
  {
    it: "plays out as its text says",
    story: `
      programme surrendered
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "on the map: Escalation falls 2 to 1 after LIO's points, then to 0 at turn end",
    map: true,
    story: `
      programme surrendered
      points:lio:2
      escalation:2:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:1:0
    `,
  },
]);
