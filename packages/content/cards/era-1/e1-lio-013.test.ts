// e1-lio-013 Oslo Accords: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-013", "Oslo Accords", [
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      handshake
      points:lio:1
      points:sae:1
      triggerSet:turnEnd
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
    `,
  },
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      handshake
      points:lio:1
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "on the map, when SAE says yes: Escalation falls 2 to 1 as the event's last step",
    map: true,
    yes: { sae: true },
    story: `
      handshake
      points:lio:1
      points:sae:1
      triggerSet:turnEnd
      escalation:2:1
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
      escalation:1:0
    `,
  },
  {
    it: "on the map, when SAE says no: Escalation still falls 2 to 1 as the event's last step",
    map: true,
    yes: { sae: false },
    story: `
      handshake
      points:lio:1
      points:lio:1
      escalation:2:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:1:0
    `,
  },
]);
