// e2-lio-002 Article 5 Invoked: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-lio-002", "Article 5 Invoked", [
  {
    it: "plays out as its text says",
    story: ["allies rally", "points:lio:1", "mod:lio:+1", "points:sae:2", "points:lio:3", "points:sae:2"],
  },
]);
