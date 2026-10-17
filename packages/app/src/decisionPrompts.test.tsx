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
  it("has a prompt for the playCard decision", () => {
    const Prompt = decisionPrompts.playCard;
    const options = { from: "hand", includeNeutral: true } as const;
    const html = renderToString(<Prompt decision={{ id: "d2", side: "sae", kind: "playCard", options }} />);
    expect(html).toContain("sae: play a card");
  });
});
