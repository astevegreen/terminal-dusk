// The chooseAction prompt (R16b, #316): all the points go to one action, placing or one intervention.
import { createElement } from "react";
import type { AnswerValue, Decision } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";
import { promptProps as props } from "./test/promptProps.ts";
import { buttonsOf } from "./testMode/promptTree.ts";

const choosing = (side: Decision["side"], points: number, targets: string[]): Decision => ({
  id: "d1",
  side,
  kind: "chooseAction",
  options: { points, actions: ["place", "intervene"], targets },
});

describe("the chooseAction prompt (R16b, #316)", () => {
  it("offers placing, then one intervention per country the decision lists, in order, each sending its answer", () => {
    const sent: AnswerValue[] = [];
    const buttons = buttonsOf(
      createElement(
        decisionPrompts.chooseAction,
        props(choosing("lio", 2, ["charlie", "echo"]), (v) => sent.push(v)),
      ),
    );
    for (const b of buttons) b.click();
    expect(buttons.map((b) => b.text)).toEqual(["Place influence", "Intervene in Charlie", "Intervene in Echo"]);
    expect(sent).toEqual([
      { kind: "chooseAction", action: "place" },
      { kind: "chooseAction", action: "intervene", country: "charlie" },
      { kind: "chooseAction", action: "intervene", country: "echo" },
    ]);
  });

  it("says that all the points go to one action, and lists the choices as text when read-only", () => {
    const html = renderToString(createElement(decisionPrompts.chooseAction, props(choosing("sae", 1, ["alpha"]))));
    expect(html).toContain("SAE: spend all 1 point on one action");
    expect(html).toContain("<li>Place influence</li><li>Intervene in Alpha</li>");
    expect(html).not.toContain("<button");
  });
});
