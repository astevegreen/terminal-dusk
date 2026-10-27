// The action menu and realign prompts (R16c, #317): one choice per action, and one per country to realign in.
import { createElement } from "react";
import type { AnswerValue, Decision } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";
import { promptProps as props } from "./test/promptProps.ts";
import { buttonsOf } from "./testMode/promptTree.ts";

const menu = (side: Decision["side"], points: number): Decision => ({
  id: "d1",
  side,
  kind: "chooseAction",
  options: { points, actions: ["place", "realign"] },
});

const realign = (side: Decision["side"], attempts: number, targets: string[]): Decision => ({
  id: "d2",
  side,
  kind: "realign",
  options: { attempts, targets },
});

describe("the chooseAction prompt (R16c, #317)", () => {
  it("has one button per action the decision lists, in order, that sends that action", () => {
    const sent: AnswerValue[] = [];
    const buttons = buttonsOf(
      createElement(
        decisionPrompts.chooseAction,
        props(menu("lio", 2), (v) => sent.push(v)),
      ),
    );
    for (const b of buttons) b.click();
    expect(buttons.map((b) => b.text)).toEqual(["Place influence", "Realign"]);
    expect(sent).toEqual([
      { kind: "chooseAction", action: "place" },
      { kind: "chooseAction", action: "realign" },
    ]);
  });

  it("offers leaving the points unspent when the menu lists pass (realign is never forced)", () => {
    const sent: AnswerValue[] = [];
    const decision: Decision = { ...menu("sae", 1), options: { points: 1, actions: ["realign", "pass"] } };
    const buttons = buttonsOf(
      createElement(
        decisionPrompts.chooseAction,
        props(decision, (v) => sent.push(v)),
      ),
    );
    for (const b of buttons) b.click();
    expect(buttons.map((b) => b.text)).toEqual(["Realign", "Leave the points unspent"]);
    expect(sent).toEqual([
      { kind: "chooseAction", action: "realign" },
      { kind: "chooseAction", action: "pass" },
    ]);
  });

  it("says the points to spend in its question", () => {
    expect(renderToString(createElement(decisionPrompts.chooseAction, props(menu("sae", 3))))).toContain(
      "sae: spend 3 points on",
    );
    expect(renderToString(createElement(decisionPrompts.chooseAction, props(menu("lio", 1))))).toContain(
      "lio: spend 1 point on",
    );
  });
});

describe("the realign prompt (R16c, #317)", () => {
  it("has one button per country the decision lists, in order, that sends that country, then one to stop", () => {
    const sent: AnswerValue[] = [];
    const buttons = buttonsOf(
      createElement(
        decisionPrompts.realign,
        props(realign("lio", 2, ["charlie", "echo"]), (v) => sent.push(v)),
      ),
    );
    for (const b of buttons) b.click();
    expect(buttons.map((b) => b.text)).toEqual(["Realign in charlie", "Realign in echo", "Stop realigning"]);
    expect(sent).toEqual([
      { kind: "realign", country: "charlie" },
      { kind: "realign", country: "echo" },
      { kind: "realign", country: null },
    ]);
  });

  it("says the attempts left in its question, and lists the countries as text when read-only", () => {
    const html = renderToString(createElement(decisionPrompts.realign, props(realign("sae", 2, ["alpha"]))));
    expect(html).toContain("sae: realign (2 attempts left)");
    expect(html).toContain("<li>Realign in alpha</li>");
    expect(html).not.toContain("<button");
    const one = renderToString(createElement(decisionPrompts.realign, props(realign("lio", 1, ["alpha"]))));
    expect(one).toContain("lio: realign (1 attempt left)");
  });
});
