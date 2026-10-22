// e2-sae-001 Invasion of Iraq: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-001", "Invasion of Iraq", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      lasting:coalition fractures
      points:sae:2
      mod:lio:-1:min1
      points:lio:1
      points:sae:2
    `,
  },
  {
    it: "when LIO plays it for points: the tag is still recorded, SAE 2 only, no LIO -1 Ops",
    rival: "points",
    story: `
      lasting:coalition fractures
      points:sae:2
      points:lio:3
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when LIO picks it as its opening card: the tag is still recorded, SAE 2 only, no LIO -1 Ops",
    rival: "opening",
    story: `
      lasting:coalition fractures
      points:sae:2
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
