// e1-neu-006 Al Jazeera Launches: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-006", "Al Jazeera Launches", [
  {
    it: "plays out as its text says",
    story: `
      new voice
      mod:lio:-1:min1
      points:sae:2
      points:lio:1
      points:sae:2
    `,
  },
]);
