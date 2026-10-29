// Choosing countries on the map (L7, #487): the countries the waiting decision lists glow with a button named after
// the choice and the country's numbers, the rest dim with no button (so a tap on one falls through to its region),
// and the List offers the same choices as buttons. Drawn without a browser: the zoom-or-answer rule and the drag
// guard are in mapControl.test.ts and the end-to-end tests.
import type { AnswerValue, CountryId, Decision } from "@terminal-dusk/engine";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { countryChoices, countryNames, picksByCountry } from "../../countryChoices.ts";
import { buttonsOf } from "../../testMode/promptTree.ts";
import { MapView } from "../MapView.tsx";
import { baseFrame, map, withMap } from "../test/mapFixture.ts";
import { DrawnMap } from "./DrawnMap.tsx";
import { layoutFor } from "./layoutFor.ts";
import { Marker } from "./Marker.tsx";
import type { MarkerProps } from "./Marker.tsx";
import { pickState } from "./mapPicks.ts";
import type { MapPicks } from "./mapPicks.ts";

const pub = withMap(baseFrame()).view.public;
const placing: Decision = {
  id: "d1",
  side: "lio",
  kind: "placeInfluence",
  options: { points: 2, countries: ["w2", "e1"] },
};

/** The picks for `decision`, recording what each handler was called with. */
function picksFor(decision: Decision) {
  const picked: [CountryId, boolean][] = [];
  const revealed: CountryId[] = [];
  const answered: AnswerValue[] = [];
  const picks: MapPicks = {
    choices: picksByCountry(countryChoices(decision, countryNames(map))),
    on: { pick: (c, keyboard) => picked.push([c, keyboard]), reveal: (c) => revealed.push(c) },
    answer: (choice) => answered.push(choice.value),
  };
  return { picks, picked, revealed, answered };
}

const drawnHtml = (picks: MapPicks | undefined): string =>
  renderToString(<DrawnMap pub={pub} layout={layoutFor(map)} touched={new Set()} onRegion={() => {}} picks={picks} />);
const markerOf = (html: string, id: string): string =>
  new RegExp(`<li class="dm-marker" data-country="${id}"[^>]*>.*?</li>`).exec(html)?.[0] ?? "";

describe("the drawn map while a decision asks for a country", () => {
  const { picks } = picksFor(placing);
  const html = drawnHtml(picks);
  it("makes the listed countries glow, each with one button named after the choice, then its numbers", () => {
    for (const id of ["w2", "e1"]) expect(markerOf(html, id)).toContain('data-pick="glow"');
    expect(markerOf(html, "w2")).toMatch(
      /<button type="button" class="dm-pick" data-choice="Place in Cedaria"><span class="dm-sr">Place in Cedaria: LIO 2, SAE 1, stability 3<\/span><\/button>/,
    );
    expect(markerOf(html, "e1")).toContain("Place in Birchmark: LIO 1, SAE 2, stability 1");
    expect(html.match(/<button[^>]*class="dm-pick"/g)).toHaveLength(2);
  });
  it("dims every other country, with no button, so a tap on it reaches its region", () => {
    for (const id of ["w1", "w3", "e2"]) {
      expect(markerOf(html, id)).toContain('data-pick="dim"');
      expect(markerOf(html, id)).not.toContain("<button");
    }
  });
  it("names countries, never their ids, in what a reader hears", () => {
    expect(html).not.toMatch(/Place in [we]\d/);
  });
  it("draws no glow, no dim and no button when no decision asks for a country", () => {
    const none = drawnHtml(undefined);
    expect(none).not.toContain("data-pick");
    expect(none).not.toContain("dm-pick");
    expect(pickState(undefined, "w1")).toBeNull();
    expect(pickState(picksFor({ ...placing, kind: "yesNo", options: {} }).picks, "w1")).toBeNull();
  });
});

/** The glowing marker's button element, drawn by Marker's own function (it is a memo element). */
function pickButtonOf(
  props: MarkerProps,
): ReactElement<{ onClick: (e: unknown) => void; onFocus: (e: unknown) => void }> {
  const inner = (Marker as unknown as { type: (p: MarkerProps) => ReactNode }).type(props);
  const find = (node: ReactNode): ReactElement | undefined => {
    if (Array.isArray(node)) return node.map(find).find((n) => n !== undefined);
    if (!isValidElement(node)) return undefined;
    if (node.type === "button") return node;
    return find((node.props as { children?: ReactNode }).children);
  };
  const found = find(inner);
  if (found === undefined) throw new Error("no button");
  return found as ReactElement<{ onClick: (e: unknown) => void; onFocus: (e: unknown) => void }>;
}

describe("a glowing country's button", () => {
  const { picks, picked, revealed } = picksFor(placing);
  const props: MarkerProps = {
    id: "w2",
    name: "Cedaria",
    short: "Cedaria",
    x: 100,
    y: 100,
    lio: 2,
    sae: 1,
    stability: 3,
    control: "lio",
    battleground: false,
    touched: false,
    pick: "glow",
    choice: "Place in Cedaria",
    on: picks.on,
  };
  const button = pickButtonOf(props);
  it("tells the map whether a tap (detail 1) or the keyboard (detail 0) clicked it", () => {
    button.props.onClick({ detail: 1 });
    button.props.onClick({ detail: 0 });
    expect(picked).toEqual([
      ["w2", false],
      ["w2", true],
    ]);
  });
  it("asks the map to move to it when the keyboard's focus arrives, not a pointer's", () => {
    button.props.onFocus({ currentTarget: { matches: () => true } });
    button.props.onFocus({ currentTarget: { matches: () => false } });
    expect(revealed).toEqual(["w2"]);
  });
});

describe("the List while a decision asks for a country", () => {
  it("gives each listed country a button that answers at once, by name, and dims the rest", () => {
    const { picks, answered } = picksFor(placing);
    const element = <MapView pub={pub} zoom={null} onZoom={() => {}} picks={picks} />;
    const buttons = buttonsOf(element).filter((b) => b.text.startsWith("Place in"));
    expect(buttons.map((b) => b.text)).toEqual(["Place in Birchmark", "Place in Cedaria"]);
    for (const b of buttons) b.click();
    expect(answered).toEqual([
      { kind: "placeInfluence", country: "e1" },
      { kind: "placeInfluence", country: "w2" },
    ]);
    const html = renderToString(element);
    expect(html.match(/data-pick="dim"/g)).toHaveLength(3);
    expect(html.match(/<button[^>]*class="map-pick"[^>]*style="min-height:44px;min-width:44px"/g)).toHaveLength(2);
  });
  it("does the same zoomed into a region", () => {
    const { picks } = picksFor(placing);
    const buttons = buttonsOf(<MapView pub={pub} zoom="west" onZoom={() => {}} picks={picks} />);
    expect(buttons.map((b) => b.text)).toContain("Place in Cedaria");
    expect(buttons.map((b) => b.text)).not.toContain("Place in Birchmark");
  });
});
