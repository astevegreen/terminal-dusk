// e2-sae-011 Munich Speech 2007: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-011", "Munich Speech 2007", [
  {
    it: "plays out as its text says",
    story: ["points:lio:2", "unipolar moment over", "mod:sae:+1", "points:lio:2", "points:sae:3"],
  },
]);
