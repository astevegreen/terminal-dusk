// e2-sae-012 Abu Ghraib: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-012", "Abu Ghraib", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      credibility hit
      points:sae:1
      mod:lio:-1:min1
      points:lio:1
      points:sae:2
    `,
  },
  {
    it: "after Invasion of Iraq recorded coalition fractures, SAE spends 2",
    before: ["e2-sae-001"],
    story: `
      points:lio:2
      credibility hit
      points:sae:2
      mod:lio:-1:min1
      points:lio:1
      points:sae:2
    `,
  },
]);
