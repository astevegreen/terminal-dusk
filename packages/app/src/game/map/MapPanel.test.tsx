// The Map area's two views (L2, #465): the drawn map, with "Whole map", or the List, which is the map as it was
// drawn before (MapView, unchanged), with a Map/List toggle above both. No map: the one line, and no toggle.
import type { PublicState, RegionId } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { button, treeOf } from "../../online/test/screenTree.ts";
import { MapView } from "../MapView.tsx";
import type { Zoom } from "../MapView.tsx";
import { baseFrame, withMap, withoutMap } from "../test/mapFixture.ts";
import { MapPanel } from "./MapPanel.tsx";
import type { MapMode } from "./MapPanel.tsx";

const pub: PublicState = withMap(baseFrame()).view.public;

function panel(mode: MapMode, zoom: Zoom = null, at: PublicState = pub) {
  const asked: string[] = [];
  const element = (
    <MapPanel
      pub={at}
      touched={new Set(["w2"])}
      mode={mode}
      zoom={zoom}
      on={{
        mode: (m: MapMode) => asked.push(`mode:${m}`),
        zoom: (z: Zoom) => asked.push(`zoom:${String(z)}`),
        region: (r: RegionId) => asked.push(`region:${r}`),
        whole: () => asked.push("whole"),
      }}
    />
  );
  return { asked, tree: treeOf(element), html: renderToString(element) };
}

const toolbarOf = (html: string): string => /<div class="dm-tools"[^>]*>.*?<\/div>/.exec(html)?.[0] ?? "";

describe("the Map/List toggle", () => {
  it("starts on Map: Map pressed, List not, and a Whole map button", () => {
    const tools = toolbarOf(panel("map").html);
    expect(tools).toContain('role="toolbar" aria-label="Map view"');
    expect(tools).toMatch(/aria-pressed="true"[^>]*>Map</);
    expect(tools).toMatch(/aria-pressed="false"[^>]*>List</);
    expect(tools).toContain(">Whole map<");
  });

  it("asks for the List, and back for the Map", () => {
    const { tree, asked } = panel("map");
    button(tree, "List").press();
    button(tree, "Map").press();
    expect(asked).toEqual(["mode:list", "mode:map"]);
  });

  it("on List, has List pressed and leaves Whole map to the list's own zoom", () => {
    const tools = toolbarOf(panel("list").html);
    expect(tools).toMatch(/aria-pressed="false"[^>]*>Map</);
    expect(tools).toMatch(/aria-pressed="true"[^>]*>List</);
    expect(tools).not.toContain("Whole map");
  });
});

describe("the Map view", () => {
  it("draws the map, highlights the touched countries, and does not show the List's badges", () => {
    const { html } = panel("map");
    expect(html.match(/class="dm-marker"/g)).toHaveLength(5);
    expect(html).toMatch(/data-country="w2"[^>]*data-touched="true"/);
    expect(html).not.toContain("map-badge");
  });

  it("a region's button asks to fit that region, and Whole map asks for the whole map", () => {
    const { tree, asked } = panel("map");
    button(tree, "Western Shore").press();
    button(tree, "Whole map").press();
    expect(asked).toEqual(["region:west", "whole"]);
  });
});

describe("the List view", () => {
  it("is today's MapView, unchanged, at the list's own zoom", () => {
    for (const zoom of [null, "east"] as const) {
      const list = renderToString(<MapView pub={pub} zoom={zoom} onZoom={() => {}} />);
      const { html } = panel("list", zoom);
      expect(html).toContain(list);
      expect(html).not.toContain("dm-marker");
    }
  });

  it("passes the list's zoom requests on", () => {
    const { tree, asked } = panel("list", "east");
    button(tree, "Whole map").press();
    expect(asked).toEqual(["zoom:null"]);
    const out = panel("list");
    button(out.tree, "Eastern Reach").press();
    expect(out.asked).toEqual(["zoom:east"]);
  });

  it("draws the whole list for a zoom naming a region the map lacks", () => {
    expect(panel("list", "north").html).toBe(panel("list", null).html);
  });
});

describe("a frame with no map", () => {
  it('shows only "No map in this game", with no toggle, in either view', () => {
    const bare = withoutMap(baseFrame()).view.public;
    for (const mode of ["map", "list"] as const) {
      const { html, tree } = panel(mode, null, bare);
      expect(html).toBe("<p>No map in this game</p>");
      expect(tree.buttons).toEqual([]);
    }
  });
});
