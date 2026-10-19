// e3-lio-009 Nordic Accession: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-009", "Nordic Accession", [
  {
    it: "plays out as its text says",
    story: ["Baltic lake", "points:lio:2", "points:sae:2", "points:lio:2", "points:sae:2"],
  },
]);
