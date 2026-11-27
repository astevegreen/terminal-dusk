// The tutorial's limits on a prompt (#641): with `allows`, a choice whose answer it refuses is drawn disabled, the
// same size as the rest; without it (every vs-AI and online game), a prompt draws exactly as before.
import type { AnswerValue, Decision } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decisionPrompts } from "./decisionPrompts.tsx";
import type { PromptProps } from "./decisionPrompts.tsx";
import { testCountryName } from "./test/promptProps.ts";

const play: Decision = {
  id: "d1",
  side: "lio",
  kind: "playCardAs",
  options: { from: "hand", uses: { own: ["event", "points"], rival: ["points"], neutral: ["points"] } },
};
const yesNo: Decision = { id: "d2", side: "lio", kind: "yesNo", options: {} };

function html(decision: Decision, extra: Partial<PromptProps> = {}): string {
  const Prompt = decisionPrompts[decision.kind];
  return renderToString(
    <Prompt
      decision={decision}
      hand={["c1", "c2"]}
      known={[]}
      label={(card) => `Card ${card}`}
      country={testCountryName}
      affiliation={() => "lio"}
      stack={[]}
      question={() => undefined}
      onAnswer={() => {}}
      {...extra}
    />,
  );
}
/** Each button's text and whether it is disabled, in order. */
const buttons = (out: string): [string, boolean][] =>
  [...out.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map((m) => [m[2]!, m[1]!.includes("disabled")]);
const isCard =
  (card: string) =>
  (v: AnswerValue): boolean =>
    "card" in v && v.card === card;

describe("prompts with the tutorial's allows (#641)", () => {
  it("draw a refused choice disabled and the allowed ones tappable", () => {
    expect(buttons(html(play, { allows: isCard("c1") }))).toEqual([
      ["Card c1: event", false],
      ["Card c1: points", false],
      ["Card c2: event", true],
      ["Card c2: points", true],
    ]);
    expect(buttons(html(yesNo, { allows: (v) => v.kind === "yesNo" && v.yes }))).toEqual([
      ["Yes", false],
      ["No", true],
    ]);
  });

  it("keep a disabled button at the 44 px tap size", () => {
    const out = html(yesNo, { allows: () => false });
    for (const m of out.matchAll(/<button[^>]*>/g)) {
      expect(m[0]).toContain("disabled");
      expect(m[0]).toContain("min-height:44px");
      expect(m[0]).toContain("min-width:44px");
    }
  });

  it("draw exactly as without allows when allows refuses nothing, and never disable a button without it", () => {
    for (const d of [play, yesNo]) {
      expect(html(d, { allows: () => true })).toBe(html(d));
      expect(html(d)).not.toContain("disabled");
    }
  });

  it("disable a refused choice on the lifted card too", () => {
    const out = html(play, { place: { card: "c2" }, allows: isCard("c1") });
    expect(buttons(out)).toEqual([
      ["Card c2: event", true],
      ["Card c2: points", true],
    ]);
  });
});
