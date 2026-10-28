import { createElement } from "react";
import type { AnswerValue, Decision, DecisionOptions, Frame as StackFrame, Side } from "@terminal-dusk/engine";
import { firstDeckCardName, firstDeckCardQuestion } from "@terminal-dusk/host/first-deck";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";
import type { PromptProps } from "./decisionPrompts.tsx";
import { buttonsOf } from "./testMode/promptTree.ts";

const label = (card: string): string => `Card ${card}`;
const noQuestion = (): undefined => undefined;
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
function pressAll(d: Decision, hand: string[], known: string[] = []) {
  const sent: AnswerValue[] = [];
  const props: PromptProps = {
    decision: d,
    hand,
    known,
    label,
    affiliation: () => "sae", // every card is the deciding side's own (the side is "sae" unless a test says otherwise)
    stack: [],
    question: noQuestion,
    onAnswer: (v) => sent.push(v),
  };
  const buttons = buttonsOf(createElement(decisionPrompts[d.kind], props));
  for (const b of buttons) b.click();
  return { texts: buttons.map((b) => b.text), sent };
}
const readOnly = (d: Decision, hand: string[], known: string[] = []) => {
  const Prompt = decisionPrompts[d.kind];
  return renderToString(
    <Prompt
      decision={d}
      hand={hand}
      known={known}
      label={label}
      affiliation={() => "sae"}
      stack={[]}
      question={noQuestion}
    />,
  );
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
    const d = decision("chooseCard", { from: "hand" }, "lio");
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
  describe("playCardAs offers each card only the uses its kind allows (#381)", () => {
    // The engine's rule: your own and a neutral card may be played for the event or the points, a rival's for the points only.
    const rules: DecisionOptions = {
      from: "hand",
      uses: { own: ["event", "points"], rival: ["points"], neutral: ["event", "points"] },
    };
    const affiliation = (card: string) => ({ mine: "sae", theirs: "lio", nobody: "neutral" })[card] as Side | "neutral";
    const offered = (card: string) => {
      const props: PromptProps = {
        decision: decision("playCardAs", rules, "sae"),
        hand: [card],
        known: [],
        label,
        affiliation,
        stack: [],
        question: noQuestion,
        onAnswer: () => {},
      };
      return buttonsOf(createElement(decisionPrompts.playCardAs, props)).map((b) => b.text);
    };
    it("offers event and points for the player's own card", () => {
      expect(offered("mine")).toEqual(["Card mine: event", "Card mine: points"]);
    });
    it("offers points only for a rival's card", () => {
      expect(offered("theirs")).toEqual(["Card theirs: points"]);
    });
    it("offers event and points for a neutral card", () => {
      expect(offered("nobody")).toEqual(["Card nobody: event", "Card nobody: points"]);
    });
    it("offers what the decision says for the card's kind, not a fixed table", () => {
      const props: PromptProps = {
        decision: decision(
          "playCardAs",
          { from: "hand", uses: { own: ["points"], rival: ["event"], neutral: [] } },
          "lio",
        ),
        hand: ["mine", "theirs", "nobody"],
        known: [],
        label,
        affiliation,
        stack: [],
        question: noQuestion,
        onAnswer: () => {},
      };
      expect(buttonsOf(createElement(decisionPrompts.playCardAs, props)).map((b) => b.text)).toEqual([
        "Card mine: event",
        "Card theirs: points",
      ]);
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
      <decisionPrompts.yesNo
        decision={decision("yesNo", {})}
        hand={[]}
        known={[]}
        label={label}
        stack={[]}
        affiliation={() => "sae"}
        question={noQuestion}
        onAnswer={() => {}}
      />,
    );
    expect(html.match(/min-height:44px/g)).toHaveLength(2);
  });
});

describe("the yes/no prompt names the card that asks and its question", () => {
  const program = (source?: string): StackFrame => ({
    kind: "program",
    steps: [],
    next: 0,
    vars: [],
    ...(source ? { source } : {}),
  });
  const ifBlock: StackFrame = { kind: "if", steps: [], next: 0, vars: [] };
  const asked = "e1-lio-002";
  const expected = `SAE, ${firstDeckCardName(asked)}: Honour the assurances?`;
  /** The question's paragraph, with the id its group is labelled by. */
  const questionLine = (question: string): string => `<p id="decision-d1-question">${question}</p>`;
  const text = (stack: StackFrame[], onAnswer?: PromptProps["onAnswer"]) =>
    renderToString(
      <decisionPrompts.yesNo
        decision={decision("yesNo", {})}
        hand={[]}
        known={[]}
        label={firstDeckCardName}
        stack={stack}
        question={firstDeckCardQuestion}
        affiliation={() => "sae"}
        {...(onAnswer ? { onAnswer } : {})}
      />,
    );

  it("shows '<side>, <card name>: <question>' when the program frame's source card has a question", () => {
    expect(firstDeckCardName(asked)).not.toBe(asked);
    expect(text([program(), program(asked)], () => {})).toContain(questionLine(expected));
  });
  it("still finds the program's source card when an if frame is above it", () => {
    expect(text([program(asked), ifBlock, ifBlock], () => {})).toContain(questionLine(expected));
  });
  it("uses the nearest program frame from the top, not a lower one", () => {
    expect(text([program(asked), program()], () => {})).toContain(questionLine("SAE: yes or no?"));
  });
  it("falls back to '<side>: yes or no?' with no source card", () => {
    expect(text([program(), ifBlock], () => {})).toContain(questionLine("SAE: yes or no?"));
    expect(text([], () => {})).toContain(questionLine("SAE: yes or no?"));
  });
  it("falls back to '<side>: yes or no?' when the source card has no question", () => {
    expect(firstDeckCardQuestion("e1-lio-001")).toBeUndefined();
    expect(text([program("e1-lio-001")], () => {})).toContain(questionLine("SAE: yes or no?"));
  });
  it("keeps the Yes and No buttons and their answers with a question shown", () => {
    const sent: AnswerValue[] = [];
    const props: PromptProps = {
      decision: decision("yesNo", {}),
      hand: [],
      known: [],
      label: firstDeckCardName,
      stack: [program(asked)],
      question: firstDeckCardQuestion,
      affiliation: () => "sae",
      onAnswer: (v) => sent.push(v),
    };
    const buttons = buttonsOf(createElement(decisionPrompts.yesNo, props));
    for (const b of buttons) b.click();
    expect({ texts: buttons.map((b) => b.text), sent }).toEqual({
      texts: ["Yes", "No"],
      sent: [
        { kind: "yesNo", yes: true },
        { kind: "yesNo", yes: false },
      ],
    });
  });
  it("shows the same text read-only, with no buttons", () => {
    const html = text([program(asked), ifBlock]);
    expect(html).not.toContain("<button");
    expect(html).toContain(questionLine(expected));
  });
});

describe("the discardCards prompt (#192)", () => {
  const fromHand = decision("discardCards", { from: "hand", count: 2 });
  const fromRival = decision("discardCards", { from: "rivalHand", count: 2 }, "lio");
  const pairs = [
    ["a", "b"],
    ["a", "c"],
    ["b", "c"],
  ];

  it('"hand": one button per set of count cards from the hand, in order, labelled "Discard A, B"', () => {
    expect(pressAll(fromHand, ["a", "b", "c"], ["x", "y"])).toEqual({
      texts: ["Discard Card a, Card b", "Discard Card a, Card c", "Discard Card b, Card c"],
      sent: pairs.map((cards) => ({ kind: "discardCards", cards })),
    });
  });

  it('"rivalHand": the sets come from the cards the viewer knows, not its own hand', () => {
    expect(pressAll(fromRival, ["x", "y"], ["a", "b", "c"])).toEqual({
      texts: ["Discard Card a, Card b", "Discard Card a, Card c", "Discard Card b, Card c"],
      sent: pairs.map((cards) => ({ kind: "discardCards", cards })),
    });
  });

  it("renders both cases read-only with renderToString: the question and the choices as text, no buttons", () => {
    const own = readOnly(fromHand, ["a", "b", "c"], ["x"]);
    const rival = readOnly(fromRival, ["x"], ["a", "b", "c"]);
    expect(own).toContain("SAE: discard 2 cards from your hand");
    expect(rival).toContain("LIO: discard 2 cards from the rival&#x27;s hand");
    for (const html of [own, rival]) {
      expect(html).not.toContain("<button");
      expect(html).toContain("<li>Discard Card a, Card b</li><li>Discard Card a, Card c</li>");
      expect(html).not.toContain("Card x");
    }
  });

  it("with one card to discard, offers each card on its own", () => {
    const d = decision("discardCards", { from: "hand", count: 1 });
    expect(pressAll(d, ["a", "b"]).texts).toEqual(["Discard Card a", "Discard Card b"]);
  });
});

describe("decisionPrompts without an onAnswer", () => {
  it("shows what is asked and lists the choices as text, with no buttons", () => {
    const cases: [Decision, string[], string[]][] = [
      [decision("yesNo", {}), [], ["SAE: yes or no?", "Yes", "No"]],
      [decision("chooseCard", { from: "hand" }, "lio"), ["a"], ["LIO: pick an opening card", "Card a"]],
      [decision("playCardAs", play), ["a"], ["SAE: play a card for its event or its points", "Card a: event"]],
      [
        decision("rivalEventOrder", {}, "lio"),
        [],
        ["LIO: the rival&#x27;s event happens before or after your points?", "After the points"],
      ],
    ];
    for (const [d, hand, texts] of cases) {
      const html = readOnly(d, hand);
      expect(html).not.toContain("<button");
      for (const text of texts) expect(html).toContain(text);
    }
  });
});

describe("each prompt is a group named by its question", () => {
  const kinds: [Decision, string[]][] = [
    [decision("yesNo", {}), []],
    [decision("chooseCard", { from: "hand" }, "lio"), ["a"]],
    [decision("playCardAs", play), ["a"]],
    [decision("rivalEventOrder", {}, "lio"), []],
    [decision("discardCards", { from: "hand", count: 1 }), ["a"]],
    [decision("placeInfluence", { points: 1, countries: ["alpha"] }), []],
    [decision("chooseAction", { points: 1, actions: ["place", "intervene", "realign"], targets: ["alpha"] }), []],
    [decision("realign", { attempts: 1, targets: ["alpha"] }), []],
  ];
  const answerable = (d: Decision, hand: string[]) => {
    const Prompt = decisionPrompts[d.kind];
    return renderToString(
      <Prompt
        decision={d}
        hand={hand}
        known={[]}
        label={label}
        affiliation={() => "sae"}
        stack={[]}
        question={noQuestion}
        onAnswer={() => {}}
      />,
    );
  };
  const opening = (id: string, side: Decision["side"]): Decision => ({
    ...decision("chooseCard", { from: "hand" }, side),
    id,
  });
  it("puts every prompt in a role=group section labelled by the question's element, id from decision.id", () => {
    for (const [d, hand] of kinds) {
      for (const html of [readOnly(d, hand), answerable(d, hand)]) {
        expect(html).toMatch(
          /^<section role="group" aria-labelledby="decision-d1-question"><p id="decision-d1-question">/,
        );
      }
    }
  });
  it("gives two prompts with different decision ids different question ids", () => {
    const lio = readOnly(opening("d3-lio", "lio"), []);
    const sae = readOnly(opening("d3-sae", "sae"), []);
    expect(lio).toContain('aria-labelledby="decision-d3-lio-question"><p id="decision-d3-lio-question">');
    expect(sae).toContain('aria-labelledby="decision-d3-sae-question"><p id="decision-d3-sae-question">');
  });
  it("keeps the read-only choices a plain <ul> of <li>, never a group", () => {
    const html = readOnly(decision("yesNo", {}), []);
    expect(html).toContain("<ul><li>Yes</li><li>No</li></ul>");
    expect(html).not.toMatch(/<ul [^>]*role=/);
  });
});
