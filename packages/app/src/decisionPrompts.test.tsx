import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";

describe("decisionPrompts", () => {
  it("has a prompt for the pass decision", () => {
    const Prompt = decisionPrompts.pass;
    const html = renderToString(<Prompt decision={{ id: "d0", side: "lio", kind: "pass", options: {} }} />);
    expect(html).toContain("lio must pass");
  });
  it("has a prompt for the yesNo decision", () => {
    const Prompt = decisionPrompts.yesNo;
    const html = renderToString(<Prompt decision={{ id: "d1", side: "sae", kind: "yesNo", options: {} }} />);
    expect(html).toContain("sae: yes or no?");
  });
});
