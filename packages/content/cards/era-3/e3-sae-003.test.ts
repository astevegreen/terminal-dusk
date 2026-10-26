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

/** LIO's first play when LIO plays the card: its 3 points for points, or a filler's 2 after picking it to open. */
const lioFirst = { points: 3, opening: 2 } as const;

/** The story when LIO plays the card and SAE spends `n` points from it: LIO still spends 1 at turn end. */
const crimeaByLio = (rival: "points" | "opening", n: number) => `
  borders redrawn
  points:sae:${n}
  triggerSet:turnEnd
  points:lio:${lioFirst[rival]}
  points:sae:2
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
  {
    it: "when LIO plays it for points without either tag, SAE spends 2",
    rival: "points",
    story: crimeaByLio("points", 2),
  },
  {
    it: "when LIO picks it as its opening card without either tag, SAE spends 2",
    rival: "opening",
    story: crimeaByLio("opening", 2),
  },
  {
    it: "when LIO plays it for points after Budapest Memorandum recorded hollow assurance, SAE spends 3",
    rival: "points",
    before: [budapestNo],
    story: crimeaByLio("points", 3),
  },
  {
    it: "when LIO plays it for points after Kosovo Declares Independence recorded precedent set, SAE spends 3",
    rival: "points",
    before: ["e2-neu-007"],
    story: crimeaByLio("points", 3),
  },
  {
    it: "on the map: Escalation rises 2 to 3 after the turn-end trigger is set, as the event's last step",
    map: true,
    story: `
      points:lio:2
      borders redrawn
      points:sae:3
      triggerSet:turnEnd
      escalation:2:3
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
      escalation:3:2
    `,
  },
  {
    it: "on the map, when LIO plays it for points: Escalation still rises 2 to 3",
    map: true,
    rival: "points",
    story: `
      borders redrawn
      points:sae:2
      triggerSet:turnEnd
      escalation:2:3
      points:lio:3
      points:sae:2
      points:lio:2
      points:sae:2
      triggerFired:turnEnd
      points:lio:1
      escalation:3:2
    `,
  },
]);
