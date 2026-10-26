// e2-lio-004 ABM Treaty Withdrawal: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-004", "ABM Treaty Withdrawal", [
  {
    it: "when LIO says no",
    yes: { lio: false },
    story: `
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO says yes",
    yes: { lio: true },
    story: `
      treaty gone
      points:lio:2
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "on the map, when LIO says no: Escalation does not move until the turn-end fall",
    map: true,
    yes: { lio: false },
    story: `
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:2:1
    `,
  },
  {
    it: "on the map, when LIO says yes: Escalation rises 2 to 3 after both sides' points, then falls to 2 at turn end",
    map: true,
    yes: { lio: true },
    story: `
      treaty gone
      points:lio:2
      points:sae:1
      escalation:2:3
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:3:2
    `,
  },
]);
