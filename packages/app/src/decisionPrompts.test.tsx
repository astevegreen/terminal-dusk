import { createElement } from "react";
import type { AnswerValue, Decision, DecisionOptions } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";
import type { PromptProps } from "./decisionPrompts.tsx";
import { buttonsOf } from "./testMode/promptTree.ts";

const label = (card: string): string => `Card ${card}`;
const play: DecisionOptions = {
  from: "hand",
  uses: { own: ["event", "points"], rival: ["points"], neutral: ["points"] },
};
const decision = (kind: Decision["kind"], options: DecisionOptions, side: Decision["side"] = "sae"): Decision => ({
  id: "d1",
  side,
  kind,
  options,
});

/** The buttons of a prompt, and the answers sent when each is pressed in turn. */
function pressAll(d: Decision, hand: string[]) {
  const sent: AnswerValue[] = [];
  const props: PromptProps = { decision: d, hand, label, onAnswer: (v) => sent.push(v) };
  const buttons = buttonsOf(createElement(decisionPrompts[d.kind], props));
  for (const b of buttons) b.click();
  return { texts: buttons.map((b) => b.text), sent };
}
const readOnly = (d: Decision, hand: string[]) => {
  const Prompt = decisionPrompts[d.kind];
  return renderToString(<Prompt decision={d} hand={hand} label={label} />);
};

describe("decisionPrompts with an onAnswer", () => {
  it("yesNo has a Yes and a No button that send the answer", () => {
    expect(pressAll(decision("yesNo", {}), [])).toEqual({
      texts: ["Yes", "No"],
      sent: [
        { kind: "yesNo", yes: true },
        { kind: "yesNo", yes: false },
      ],
    });
  });
  it("chooseCard has one button per card in the hand", () => {
    const d = decision("chooseCard", { from: "hand", includeNeutral: false }, "lio");
    expect(pressAll(d, ["a", "b", "c"])).toEqual({
      texts: ["Card a", "Card b", "Card c"],
      sent: ["a", "b", "c"].map((card) => ({ kind: "chooseCard", card })),
    });
  });
  it("playCardAs has a button for each card and each use the decision allows", () => {
    expect(pressAll(decision("playCardAs", play), ["a", "b"])).toEqual({
      texts: ["Card a: event", "Card a: points", "Card b: event", "Card b: points"],
      sent: [
        { kind: "playCardAs", card: "a", as: "event" },
        { kind: "playCardAs", card: "a", as: "points" },
        { kind: "playCardAs", card: "b", as: "event" },
        { kind: "playCardAs", card: "b", as: "points" },
      ],
    });
  });
  it("playCardAs offers only the uses that appear in the decision", () => {
    const d = decision("playCardAs", { from: "hand", uses: { own: ["points"], rival: ["points"], neutral: [] } });
    expect(pressAll(d, ["a"]).texts).toEqual(["Card a: points"]);
  });
  it("rivalEventOrder has a before and an after button", () => {
    expect(pressAll(decision("rivalEventOrder", {}, "lio"), [])).toEqual({
      texts: ["Before the points", "After the points"],
      sent: [
        { kind: "rivalEventOrder", event: "before" },
        { kind: "rivalEventOrder", event: "after" },
      ],
    });
  });
  it("makes every button at least 44 px tall", () => {
    const html = renderToString(
      <decisionPrompts.yesNo decision={decision("yesNo", {})} hand={[]} label={label} onAnswer={() => {}} />,
    );
    expect(html.match(/min-height:44px/g)).toHaveLength(2);
  });
});

describe("decisionPrompts without an onAnswer", () => {
  it("shows what is asked and lists the choices as text, with no buttons", () => {
    const cases: [Decision, string[], string[]][] = [
      [decision("yesNo", {}), [], ["sae: yes or no?", "Yes", "No"]],
      [
        decision("chooseCard", { from: "hand", includeNeutral: false }, "lio"),
        ["a"],
        ["lio: pick an opening card", "Card a"],
      ],
      [decision("playCardAs", play), ["a"], ["sae: play a card for its event or its points", "Card a: event"]],
      [
        decision("rivalEventOrder", {}, "lio"),
        [],
        ["lio: the rival&#x27;s event happens before or after your points?", "After the points"],
      ],
    ];
    for (const [d, hand, texts] of cases) {
      const html = readOnly(d, hand);
      expect(html).not.toContain("<button");
      for (const text of texts) expect(html).toContain(text);
    }
  });
});
