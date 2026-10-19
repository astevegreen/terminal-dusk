// e3-sae-010 Fall of Kabul: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-sae-010", "Fall of Kabul", [
  {
    it: "plays out as its text says",
    story: ["points:lio:2", "resolve questioned", "points:sae:1", "mod:lio:-1:min1", "points:lio:1", "points:sae:2"],
  },
]);
