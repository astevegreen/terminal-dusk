// e3-sae-003 Annexation of Crimea: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";
import type { EarlierCard } from "../../src/test/playCard.ts";

/** The story when SAE spends `n` points from the card: LIO spends 1 at turn end either way. */
const crimea = (n: number) => `
  points:lio:2
  borders redrawn
  points:sae:${n}
  triggerSet:turnEnd
  points:lio:2
  points:sae:2
  triggerFired:turnEnd
  points:lio:1
`;

/** Budapest Memorandum with SAE saying no, which records "hollow assurance". */
const budapestNo: EarlierCard = { card: "e1-lio-002", yes: { sae: false } };

describeCard("e3-sae-003", "Annexation of Crimea", [
  {
    it: "without hollow assurance or precedent set, SAE spends 3",
    story: crimea(3),
  },
  {
    it: "after Budapest Memorandum recorded hollow assurance, SAE spends 4",
    before: [budapestNo],
    story: crimea(4),
  },
  {
    it: "after Kosovo Declares Independence recorded precedent set, SAE spends 4",
    before: ["e2-neu-007"],
    story: crimea(4),
  },
  {
    it: "with both hollow assurance and precedent set recorded, SAE spends 4 once",
    before: [budapestNo, "e2-neu-007"],
    story: crimea(4),
  },
]);
