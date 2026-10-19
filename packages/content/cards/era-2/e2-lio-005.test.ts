// e2-lio-005 Banco Delta Asia: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-005", "Banco Delta Asia", [
  {
    it: "when LIO draws 2",
    draw: 2,
    story: [
      "accounts frozen",
      "draw:lio:2",
      "points:lio:1",
      "points:sae:1",
      "points:sae:2",
      "points:lio:2",
      "points:sae:2",
    ],
  },
  {
    it: "when LIO draws 3",
    draw: 3,
    story: ["accounts frozen", "draw:lio:3", "points:lio:2", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
