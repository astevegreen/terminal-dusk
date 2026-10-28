// The real six-region map on screen (A14, issue #439): 6 region buttons and 42 badges zoomed out, each region's
// boxes zoomed in, Crimea's own box, and both home boxes in every view. The map comes from the host's
// sixRegionMapConfig through a real local match, as the app gets it.
import type { PublicState } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { firstDeckRuleset, sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { treeOf } from "../online/test/screenTree.ts";
import { createLocalMatch } from "../transport/localMatch.ts";
import { MapView } from "./MapView.tsx";
import type { Zoom } from "./MapView.tsx";

function firstFrame(): Frame {
  const made = createLocalMatch(firstDeckRuleset, sixRegionMapConfig(), "six-region-view", () => 0);
  if (!made.ok) throw new Error(made.error.code);
  let frame: Frame | null = null;
  made.value.transportFor("lio").subscribe((f) => (frame = f))();
  if (!frame) throw new Error("no frame");
  return frame;
}
const pub: PublicState = firstFrame().view.public;
const map = pub.map!;

function drawn(zoom: Zoom) {
  const element = <MapView pub={pub} zoom={zoom} onZoom={() => {}} />;
  return { tree: treeOf(element), html: renderToString(element) };
}
const countriesOf = (html: string, className: string): string[] =>
  [...html.matchAll(new RegExp(`<li class="${className}" data-country="([^"]+)"`, "g"))].map((m) => m[1]!);
const boxOf = (html: string, id: string): string => {
  const match = new RegExp(`<li class="map-box" data-country="${id}"[^>]*>.*?</li>`).exec(html);
  if (!match) throw new Error(`no box for ${id}`);
  return match[0];
};
const homeBoxes = (html: string): string[] =>
  [...html.matchAll(/<li class="map-home" data-home="(lio|sae)"[^>]*>([^<]+)<\/li>/g)].map((m) => `${m[1]}:${m[2]}`);

describe("the six-region map zoomed out", () => {
  const { tree, html } = drawn(null);
  it("has a button per region, in the map's order, with each region's full name", () => {
    expect(tree.buttons.map((b) => b.text)).toEqual(map.regions.map((r) => r.name));
    expect(tree.buttons).toHaveLength(6);
    expect(tree.buttons.map((b) => b.text)).toContain("Eastern Europe and Central Asia");
  });
  it("draws all 42 countries as badges, Crimea's apart from Ukraine's", () => {
    const badges = countriesOf(html, "map-badge");
    expect(badges).toHaveLength(42);
    expect(new Set(badges).size).toBe(42);
    expect(badges).toEqual(expect.arrayContaining(["crimea", "ukraine"]));
  });
  it("shows the LIO and SAE home boxes, which are not buttons", () => {
    expect(homeBoxes(html)).toEqual(["lio:LIO home box", "sae:SAE home box"]);
    expect(tree.buttons.map((b) => b.text)).not.toContain("LIO home box");
  });
});

describe("each region of the six-region map zoomed in", () => {
  for (const region of map.regions) {
    it(`${region.name}: its countries' boxes, the Whole map button and both home boxes`, () => {
      const { tree, html } = drawn(region.id);
      const ids = map.countries.filter((c) => c.region === region.id).map((c) => c.id);
      expect(countriesOf(html, "map-box")).toEqual(ids);
      expect(countriesOf(html, "map-badge")).toEqual([]);
      expect(tree.buttons.map((b) => b.text)).toEqual(["Whole map"]);
      expect(homeBoxes(html)).toEqual(["lio:LIO home box", "sae:SAE home box"]);
    });
  }
  it("adds up to 42 boxes over the 6 regions", () => {
    const all = map.regions.flatMap((r) => countriesOf(drawn(r.id).html, "map-box"));
    expect(all).toHaveLength(42);
  });
});

describe("a zoomed-in box next to a home box", () => {
  const eastern = drawn("eastern-europe-central-asia").html;
  const americas = drawn("americas").html;
  it("says which side's home box it touches, from the map's home box lists", () => {
    expect(boxOf(americas, "mexico")).toContain("Next to LIO home");
    expect(boxOf(americas, "mexico")).not.toContain("Next to SAE home");
    expect(boxOf(eastern, "ukraine")).toContain("Next to SAE home");
    expect(boxOf(americas, "brazil")).not.toContain("Next to");
  });
  it("Crimea has its own box with its own stability and SAE's starting influence, apart from Ukraine's", () => {
    expect(boxOf(eastern, "crimea")).toMatch(/>Crimea<.*>Stability <b>2<\/b>.*>LIO <b>0<\/b>.*>SAE <b>1<\/b>/);
    expect(boxOf(eastern, "ukraine")).toMatch(/>Ukraine<.*>LIO <b>0<\/b>.*>SAE <b>0<\/b>/);
  });
});
