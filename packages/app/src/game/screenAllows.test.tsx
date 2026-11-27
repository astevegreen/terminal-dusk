// The tutorial's limits on the game screen (#641): with `allows`, a refused country dims on the map with nothing to
// tap, and its List button is disabled; a refused banner choice is disabled. Without it, nothing changes.
import type { AnswerValue, Decision } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { countryChoices, countryNames, picksByCountry } from "../countryChoices.ts";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { GameScreen } from "./GameScreen.tsx";
import type { GameScreenProps } from "./GameScreen.tsx";
import { MapView } from "./MapView.tsx";
import { pickState, tappable, type MapPicks } from "./map/mapPicks.ts";
import { baseFrame, map, withMap } from "./test/mapFixture.ts";

const asking = (decision: Decision): Frame => ({ ...withMap(baseFrame()), decision });
const html = (frame: Frame, extra: Partial<GameScreenProps> = {}): string =>
  renderToString(
    <GameScreen
      frame={frame}
      log={[]}
      era={null}
      label={cardName}
      question={cardQuestion}
      affiliation={cardAffiliation}
      onAnswer={() => {}}
      {...extra}
    />,
  );
const picked = (out: string, state: "glow" | "dim"): string[] =>
  [...out.matchAll(new RegExp(`<li class="dm-marker" data-country="([^"]+)"[^>]*data-pick="${state}"`, "g"))]
    .map((m) => m[1]!)
    .sort();

const placing: Decision = {
  id: "d9",
  side: "lio",
  kind: "placeInfluence",
  options: { points: 3, countries: ["w2", "e1"] },
};
const realign: Decision = { id: "d9", side: "lio", kind: "realign", options: { attempts: 2, targets: ["w3"] } };
const onlyIn =
  (country: string) =>
  (v: AnswerValue): boolean =>
    "country" in v && v.country === country;

describe("the game screen with the tutorial's allows (#641)", () => {
  it("glows only the allowed country and dims the refused one, with no button on it", () => {
    const out = html(asking(placing), { allows: onlyIn("w2") });
    expect(picked(out, "glow")).toEqual(["w2"]);
    expect(picked(out, "dim")).toContain("e1");
    expect(out).toContain(`data-choice="Place in ${countryNames(map)("w2")}"`);
    expect(out).not.toContain(`data-choice="Place in ${countryNames(map)("e1")}"`);
  });

  it("disables a refused banner choice", () => {
    const out = html(asking(realign), { allows: (v) => v.kind !== "realign" || v.country !== null });
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Stop realigning<\/button>/);
  });

  it("draws exactly as before without allows, or with one that refuses nothing", () => {
    for (const d of [placing, realign]) {
      expect(html(asking(d), { allows: () => true })).toBe(html(asking(d)));
      expect(html(asking(d))).not.toContain("disabled");
    }
  });
});

describe("a disabled country choice on the map (#641)", () => {
  const choices = countryChoices(placing, countryNames(map)).map((c) =>
    c.country === "e1" ? { ...c, disabled: true as const } : c,
  );
  const picks: MapPicks = {
    choices: picksByCountry(choices),
    on: { pick: () => {}, reveal: () => {} },
    answer: () => {},
  };
  it("dims, like a country the decision does not list", () => {
    expect(pickState(picks, "e1")).toBe("dim");
    expect(pickState(picks, "w2")).toBe("glow");
  });
  it("answers nothing when tapped, while an allowed country's tap answers its choice", () => {
    expect(tappable(picks.choices, "e1")).toBeUndefined();
    expect(tappable(picks.choices, "w2")?.country).toBe("w2");
  });
  it("has a disabled button in the List view", () => {
    const pub = withMap(baseFrame()).view.public;
    const out = renderToString(<MapView pub={pub} zoom={null} onZoom={() => {}} picks={picks} />);
    const button = (country: string): string =>
      new RegExp(`<button[^>]*data-choice="Place in ${countryNames(map)(country)}"[^>]*>`).exec(out)?.[0] ?? "";
    expect(button("e1")).toContain("disabled");
    expect(button("w2")).not.toContain("disabled");
  });
});
