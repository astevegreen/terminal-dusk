// The map zoomed into a region (issue #365): region buttons, country boxes, "Whole map", zoom kept across frames.
import { controller } from "@terminal-dusk/engine";
import type { InfluenceEntry, PublicState } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { button, treeOf } from "../online/test/screenTree.ts";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { buttonsOf } from "../testMode/promptTree.ts";
import { GameScreen } from "./GameScreen.tsx";
import { MapView, shownZoom } from "./MapView.tsx";
import type { Zoom } from "./MapView.tsx";
import { baseFrame, map, withMap, withoutMap } from "./test/mapFixture.ts";
import { ZoomableMap } from "./ZoomableMap.tsx";

const pubWith = (entries?: InfluenceEntry[]): PublicState => withMap(baseFrame(), entries).view.public;
const pub = pubWith();

/** The zooms MapView asked for, and its tree and html at a zoom. */
function drawn(at: PublicState, zoom: Zoom) {
  const asked: Zoom[] = [];
  const element = <MapView pub={at} zoom={zoom} onZoom={(z) => asked.push(z)} />;
  return { asked, tree: treeOf(element), html: renderToString(element) };
}

const countriesOf = (html: string, className: string): string[] =>
  [...html.matchAll(new RegExp(`<li class="${className}" data-country="([^"]+)"`, "g"))].map((m) => m[1]!);

const boxOf = (html: string, id: string): string => {
  const match = new RegExp(`<li class="map-box" data-country="${id}"[^>]*>.*?</li>`).exec(html);
  if (!match) throw new Error(`no box for ${id}`);
  return match[0];
};

const TAP_STYLE = 'style="min-height:44px;min-width:44px"';

describe("pressing a region in the zoomed-out map", () => {
  it("each region's name is a button; pressing it calls onZoom with that region", () => {
    const { tree, asked } = drawn(pub, null);
    expect(tree.buttons.map((b) => b.text)).toEqual(["Eastern Reach", "Western Shore"]);
    button(tree, "Western Shore").press();
    button(tree, "Eastern Reach").press();
    expect(asked).toEqual(["west", "east"]);
  });

  it("with that zoom, shows only that region's countries as boxes, under the region's name as a heading", () => {
    const { html } = drawn(pub, "east");
    expect(countriesOf(html, "map-box")).toEqual(["e1", "e2"]);
    expect(countriesOf(html, "map-badge")).toEqual([]);
    expect([...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1])).toEqual(["Eastern Reach"]);
    expect(html).not.toContain("Western Shore");
  });
});

describe("a country box", () => {
  const { html } = drawn(pub, "west");
  it("shows the full name, stability, LIO's influence and SAE's influence, each labelled", () => {
    expect(boxOf(html, "w1")).toMatch(/>Alderland<.*>Stability <b>2<\/b>.*>LIO <b>3<\/b>.*>SAE <b>0<\/b>/);
    expect(boxOf(html, "w2")).toMatch(/>Cedaria<.*>Stability <b>3<\/b>.*>LIO <b>2<\/b>.*>SAE <b>1<\/b>/);
    expect(boxOf(html, "w3")).toMatch(/>Elmhaven<.*>Stability <b>2<\/b>.*>LIO <b>1<\/b>.*>SAE <b>1<\/b>/);
  });

  it("counts a country with no influence entry as 0 for both sides", () => {
    expect(boxOf(drawn(pub, "east").html, "e2")).toMatch(/>Dunmoor<.*>LIO <b>0<\/b>.*>SAE <b>0<\/b>/);
  });

  it("carries the same data-control value as its badge, from the engine's controller", () => {
    const badges = drawn(pub, null).html;
    for (const zoom of ["east", "west"]) {
      const boxes = drawn(pub, zoom).html;
      for (const c of map.countries.filter((c) => c.region === zoom)) {
        const control = `data-control="${controller(pub, c.id) ?? "none"}"`;
        expect(boxOf(boxes, c.id)).toContain(control);
        expect(new RegExp(`data-country="${c.id}" ${control}`).test(badges)).toBe(true);
      }
    }
    expect(boxOf(html, "w1")).toContain('data-control="lio"');
  });
});

describe("the game screen with a map", () => {
  it("can still be walked by the prompt test helper, which steps over the map's one hook", () => {
    const frame = withMap(baseFrame());
    const element = (
      <GameScreen
        frame={frame}
        log={[]}
        era={null}
        label={cardName}
        question={cardQuestion}
        affiliation={cardAffiliation}
        onAnswer={() => {}}
      />
    );
    expect(buttonsOf(element).length).toBeGreaterThan(0);
    expect(renderToString(element)).toContain(">Eastern Reach</button>");
  });
});

describe("tap targets", () => {
  it("the region buttons, the Whole map button and each country box are at least 44 by 44 CSS px", () => {
    const out = drawn(pub, null).html;
    const zoomed = drawn(pub, "west").html;
    const buttons = [...`${out}${zoomed}`.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(3);
    for (const b of buttons) expect(b).toContain(TAP_STYLE);
    for (const id of ["w1", "w2", "w3"]) expect(boxOf(zoomed, id)).toContain(TAP_STYLE);
  });
});

describe("the Whole map button", () => {
  it("is shown only while zoomed in", () => {
    expect(drawn(pub, null).tree.buttons.map((b) => b.text)).not.toContain("Whole map");
    expect(drawn(pub, "east").tree.buttons.map((b) => b.text)).toEqual(["Whole map"]);
  });

  it("calls onZoom(null), and with no zoom the badges show again", () => {
    const { tree, asked } = drawn(pub, "east");
    button(tree, "Whole map").press();
    expect(asked).toEqual([null]);
    const { html } = drawn(pub, null);
    expect(countriesOf(html, "map-badge")).toEqual(["e1", "e2", "w1", "w2", "w3"]);
    expect(countriesOf(html, "map-box")).toEqual([]);
  });
});

describe("the zoom across frames", () => {
  it("a new frame with the same zoom (the rival moves) shows the same region with the new numbers", () => {
    const before = drawn(pub, "west").html;
    const moved = pubWith([
      { country: "w1", lio: 3, sae: 4 },
      { country: "w2", lio: 2, sae: 1 },
    ]);
    const after = drawn(moved, "west").html;
    expect(countriesOf(after, "map-box")).toEqual(countriesOf(before, "map-box"));
    expect(boxOf(before, "w1")).toMatch(/>LIO <b>3<\/b>.*>SAE <b>0<\/b>/);
    expect(boxOf(after, "w1")).toMatch(/>LIO <b>3<\/b>.*>SAE <b>4<\/b>/);
    expect(boxOf(after, "w1")).toContain(`data-control="${controller(moved, "w1") ?? "none"}"`);
    expect(boxOf(after, "w3")).toMatch(/>LIO <b>0<\/b>.*>SAE <b>0<\/b>/);
  });

  it("shownZoom keeps a region the map has and turns any other zoom, or a missing map, into null", () => {
    expect(shownZoom(map, "east")).toBe("east");
    expect(shownZoom(map, null)).toBeNull();
    expect(shownZoom(map, "north")).toBeNull();
    expect(shownZoom(undefined, "east")).toBeNull();
  });

  it("a zoom naming a region not in the frame's map draws the zoomed-out view", () => {
    expect(drawn(pub, "north").html).toBe(drawn(pub, null).html);
  });

  it("the wrapper starts zoomed out", () => {
    expect(renderToString(<ZoomableMap pub={pub} />)).toBe(drawn(pub, null).html);
  });
});

describe("a frame with no map", () => {
  it('still shows "No map in this game" and offers no zoom', () => {
    const bare = withoutMap(baseFrame()).view.public;
    for (const zoom of [null, "east"]) {
      const { html, tree } = drawn(bare, zoom);
      expect(html).toBe("<p>No map in this game</p>");
      expect(tree.buttons).toEqual([]);
    }
    expect(renderToString(<ZoomableMap pub={bare} />)).toBe("<p>No map in this game</p>");
  });
});
