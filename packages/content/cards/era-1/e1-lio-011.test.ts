// e1-lio-011 Dot-com Boom: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-011", "Dot-com Boom", [
  {
    it: "plays out as its text says",
    story: `
      network effect
      points:lio:1
      triggerSet:cardPlayed
      points:sae:2
      triggerFired:cardPlayed
      points:lio:1
      points:lio:2
      triggerFired:cardPlayed
      points:lio:1
      points:sae:2
      triggerFired:cardPlayed
      points:lio:1
    `,
  },
]);
