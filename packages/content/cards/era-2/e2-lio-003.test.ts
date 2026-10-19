// e2-lio-003 Colour Revolutions: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-003", "Colour Revolutions", [
  {
    it: "plays out as its text says",
    story: ["colour revolution", "points:lio:2", "mod:lio:+1", "points:sae:2", "points:lio:3", "points:sae:2"],
  },
]);
