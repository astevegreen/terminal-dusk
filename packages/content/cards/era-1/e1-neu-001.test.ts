// e1-neu-001 Rwandan Genocide: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e1-neu-001", "Rwandan Genocide", [
  {
    it: "without intervention fatigue, both sides count 1 less this turn",
    story: `
      the world looks away
      mod:both:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
  {
    it: "after Battle of Mogadishu recorded intervention fatigue, LIO counts 2 less and SAE 1 less this turn",
    before: ["e1-sae-001"],
    story: `
      the world looks away
      mod:lio:-2:min1
      mod:sae:-1:min1
      points:sae:1
      points:lio:1
      points:sae:1
    `,
  },
]);
