// e2-sae-010 Peace Mission 2005: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-010", "Peace Mission 2005", [
  {
    it: "plays out as its text says",
    story: `
      points:lio:2
      joint exercise
      points:sae:2
      mod:sae:+1
      points:lio:2
      points:sae:3
    `,
  },
]);
