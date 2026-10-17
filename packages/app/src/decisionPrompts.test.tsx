import type { DecisionOptions } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";

describe("decisionPrompts", () => {
  it("has a prompt for the yesNo decision", () => {
    const Prompt = decisionPrompts.yesNo;
    const html = renderToString(<Prompt decision={{ id: "d1", side: "sae", kind: "yesNo", options: {} }} />);
    expect(html).toContain("sae: yes or no?");
  });
  it("has a prompt for the chooseCard decision, the opening card pick", () => {
    const Prompt = decisionPrompts.chooseCard;
    const options = { from: "hand", includeNeutral: false } as const;
    const html = renderToString(<Prompt decision={{ id: "d0-lio", side: "lio", kind: "chooseCard", options }} />);
    expect(html).toContain("lio: pick an opening card");
  });
  it("has a prompt for the playCardAs decision, a play for its event or its points", () => {
    const Prompt = decisionPrompts.playCardAs;
    const options: DecisionOptions = {
      from: "hand",
      uses: { own: ["event", "points"], rival: ["points"], neutral: ["points"] },
    };
    const html = renderToString(<Prompt decision={{ id: "d2", side: "sae", kind: "playCardAs", options }} />);
    expect(html).toContain("sae: play a card for its event or its points");
  });
  it("has a prompt for the rivalEventOrder decision", () => {
    const Prompt = decisionPrompts.rivalEventOrder;
    const html = renderToString(<Prompt decision={{ id: "d3", side: "lio", kind: "rivalEventOrder", options: {} }} />);
    expect(html).toContain("lio: the rival&#x27;s event happens before or after your points?");
  });
});
