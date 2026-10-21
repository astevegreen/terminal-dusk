// e3-lio-001 Stuxnet: one test for each way its effect can play out.
import { describeCard } from "../../src/test/describeCard.ts";

describeCard("e3-lio-001", "Stuxnet", [
  {
    it: "without programme revealed, when LIO draws 1, the worm escapes",
    draw: 1,
    story: `
      draw:lio:1
      cyberweapon loose
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "without programme revealed, when LIO draws 2, the worm escapes",
    draw: 2,
    story: `
      draw:lio:2
      cyberweapon loose
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "without programme revealed, when LIO draws 3, the sabotage works",
    draw: 3,
    story: `
      draw:lio:3
      centrifuges spin apart
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "after Natanz Revealed recorded programme revealed, when LIO draws 1, the worm escapes",
    before: ["e2-neu-006"],
    draw: 1,
    story: `
      draw:lio:1
      cyberweapon loose
      points:sae:1
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
  {
    it: "after Natanz Revealed recorded programme revealed, when LIO draws 2, the sabotage works",
    before: ["e2-neu-006"],
    draw: 2,
    story: `
      draw:lio:2
      centrifuges spin apart
      points:lio:2
      points:sae:2
      points:lio:2
      points:sae:2
    `,
  },
]);
