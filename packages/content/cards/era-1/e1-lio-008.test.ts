// e1-lio-008 GPS Signal Opened: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-lio-008", "GPS Signal Opened", [
  {
    it: "plays out as its text says",
    story: `
      signal opened
      mod:lio:+1
      points:sae:2
      points:lio:3
      points:sae:2
    `,
  },
]);
