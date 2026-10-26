// e1-neu-004 Test Ban Treaty: one test for each way its effect can play out.
import { bothSidesAsked, describeCard } from "../../src/test/describeCard.ts";

describeCard(
  "e1-neu-004",
  "Test Ban Treaty",
  bothSidesAsked({
    yesYes: `
      treaty in force
      points:lio:2
      points:sae:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
    yesNo: `
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
    noYes: `
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
    noNo: `
      treaty stalled
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  }),
);

describeCard("e1-neu-004", "Test Ban Treaty on the map", [
  {
    it: "when both ratify, Escalation falls 2 to 1 after both sides' points, then to 0 at turn end",
    map: true,
    yes: { lio: true, sae: true },
    story: `
      treaty in force
      points:lio:2
      points:sae:2
      escalation:2:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:1:0
    `,
  },
  {
    it: "when LIO ratifies and SAE does not, Escalation does not move until the turn-end fall",
    map: true,
    yes: { lio: true, sae: false },
    story: `
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:2:1
    `,
  },
  {
    it: "when SAE ratifies and LIO does not, Escalation does not move until the turn-end fall",
    map: true,
    yes: { lio: false, sae: true },
    story: `
      points:lio:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:2:1
    `,
  },
  {
    it: "when neither ratifies, Escalation does not move until the turn-end fall",
    map: true,
    yes: { lio: false, sae: false },
    story: `
      treaty stalled
      points:lio:1
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
      escalation:2:1
    `,
  },
]);
