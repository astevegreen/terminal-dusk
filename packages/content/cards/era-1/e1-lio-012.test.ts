// e1-lio-012 Partnership for Peace: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-012", "Partnership for Peace", [
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      partners, not members
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE says no",
    yes: { sae: false },
    story: `
      partners, not members
      points:lio:1
      mod:sae:-1:min1
      points:sae:1
      points:lio:2
      points:sae:1
    `,
  },
  {
    it: "on the map, when SAE says yes: Escalation falls 2 to 1 as the event's last step",
    map: true,
    yes: { sae: true },
    story: `
      partners, not members
      points:lio:1
      points:sae:1
      escalation:2:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:1:0
    `,
  },
  {
    it: "on the map, when SAE says no: Escalation still falls 2 to 1 as the event's last step",
    map: true,
    yes: { sae: false },
    story: `
      partners, not members
      points:lio:1
      mod:sae:-1:min1
      escalation:2:1
      points:sae:1
      points:lio:2
      points:sae:1
      escalation:1:0
    `,
  },
]);
