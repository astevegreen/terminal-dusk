// The placeInfluence prompt (R16a, #315): one choice per country a placing lists.
import { createElement } from "react";
import type { AnswerValue, Decision } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";
import { promptProps as props } from "./test/promptProps.ts";
import { buttonsOf } from "./testMode/promptTree.ts";

const placing = (side: Decision["side"], points: number, countries: string[]): Decision => ({
  id: "d1",
  side,
  kind: "placeInfluence",
  options: { points, countries },
});

describe("the placeInfluence prompt (R16a, #315)", () => {
  it("has one button per country the decision lists, in order, that sends that country", () => {
    const sent: AnswerValue[] = [];
    const buttons = buttonsOf(
      createElement(
        decisionPrompts.placeInfluence,
        props(placing("lio", 2, ["alpha", "bravo"]), (v) => sent.push(v)),
      ),
    );
    for (const b of buttons) b.click();
    // Named by the country's name, never its id (L7, #487).
    expect(buttons.map((b) => b.text)).toEqual(["Place in Alpha", "Place in Bravo"]);
    expect(sent).toEqual([
      { kind: "placeInfluence", country: "alpha" },
      { kind: "placeInfluence", country: "bravo" },
    ]);
  });

  it("says the points left in its question, and lists the countries as text when read-only", () => {
    const html = renderToString(
      createElement(decisionPrompts.placeInfluence, props(placing("lio", 2, ["alpha", "bravo"]))),
    );
    expect(html).toContain("LIO: place 1 influence (2 points left)");
    expect(html).toContain("<li>Place in Alpha</li><li>Place in Bravo</li>");
    expect(html).not.toContain("<button");
  });

  it("says 1 point, not 1 points, when one is left", () => {
    const html = renderToString(createElement(decisionPrompts.placeInfluence, props(placing("sae", 1, ["alpha"]))));
    expect(html).toContain("SAE: place 1 influence (1 point left)");
  });
});
