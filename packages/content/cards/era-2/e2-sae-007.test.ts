// e2-sae-007 North Korean Nuclear Test: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e2-sae-007", "North Korean Nuclear Test", [
  {
    it: "when SAE draws 2",
    draw: 2,
    story: `
      points:lio:2
      first test
      draw:sae:2
      points:lio:1
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE draws 3",
    draw: 3,
    story: `
      points:lio:2
      first test
      draw:sae:3
      points:sae:1
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "when SAE draws 4",
    draw: 4,
    story: `
      points:lio:2
      first test
      draw:sae:4
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "on the map, when SAE draws 2: Escalation rises 2 to 3 as the event's last step",
    map: true,
    draw: 2,
    story: `
      points:lio:2
      first test
      draw:sae:2
      points:lio:1
      escalation:2:3
      points:lio:2
      points:sae:2
      escalation:3:2
    `,
  },
  {
    it: "on the map, when SAE draws 3: Escalation rises 2 to 3 as the event's last step",
    map: true,
    draw: 3,
    story: `
      points:lio:2
      first test
      draw:sae:3
      points:sae:1
      escalation:2:3
      points:lio:2
      points:sae:2
      escalation:3:2
    `,
  },
  {
    it: "on the map, when SAE draws 4: Escalation rises 2 to 3 as the event's last step",
    map: true,
    draw: 4,
    story: `
      points:lio:2
      first test
      draw:sae:4
      points:sae:2
      escalation:2:3
      points:lio:2
      points:sae:2
      escalation:3:2
    `,
  },
]);
