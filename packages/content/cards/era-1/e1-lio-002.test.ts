// e1-lio-002 Budapest Memorandum: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-002", "Budapest Memorandum", [
  {
    it: "when SAE says yes",
    yes: { sae: true },
    story: `
      assurances given
      points:lio:2
      promise kept
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
      assurances given
      points:lio:2
      lasting:hollow assurance
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "on the map, when SAE says yes: Escalation falls 2 to 1 after the event's points, then to 0 at turn end",
    map: true,
    yes: { sae: true },
    story: `
      assurances given
      points:lio:2
      promise kept
      points:sae:1
      escalation:2:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:1:0
    `,
  },
  {
    it: "on the map, when SAE says no: Escalation still falls 2 to 1, as the event's last step",
    map: true,
    yes: { sae: false },
    story: `
      assurances given
      points:lio:2
      lasting:hollow assurance
      points:lio:1
      escalation:2:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:1:0
    `,
  },
]);
