// e3-sae-011 Hong Kong Security Law: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

/** The story when SAE spends `n` points from the card and LIO says no. */
const lioSaysNo = (n: number) => `
  points:lio:2
  promise ended
  points:sae:${n}
  no sanctions
  points:lio:2
  points:sae:2
`;

/** The story when SAE spends `n` points from the card and LIO says yes. */
const lioSaysYes = (n: number) => `
  points:lio:2
  promise ended
  points:sae:${n}
  points:lio:1
  triggerSet:turnEnd
  points:lio:2
  points:sae:2
  triggerFired:turnEnd
  points:sae:1
`;

describeCard("e3-sae-011", "Hong Kong Security Law", [
  {
    it: "without one country, two systems, SAE spends 2, when LIO says no",
    yes: { lio: false },
    story: lioSaysNo(2),
  },
  {
    it: "without one country, two systems, SAE spends 2, when LIO says yes",
    yes: { lio: true },
    story: lioSaysYes(2),
  },
  {
    it: "after Handover of Hong Kong recorded one country, two systems, SAE spends 3, when LIO says no",
    before: ["e1-sae-002"],
    yes: { lio: false },
    story: lioSaysNo(3),
  },
  {
    it: "after Handover of Hong Kong recorded one country, two systems, SAE spends 3, when LIO says yes",
    before: ["e1-sae-002"],
    yes: { lio: true },
    story: lioSaysYes(3),
  },
]);
