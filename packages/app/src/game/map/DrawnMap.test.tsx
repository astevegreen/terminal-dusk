// The drawn map (L2, #465): a shaded area per region, a marker per country with its name, both sides' influence,
// its controller's colour, stability and a battleground mark, the home boxes, the lines between neighbours and to
// the home boxes, closed regions greyed, and the countries the latest frame's events touched highlighted.
import { controller, isBattleground } from "@terminal-dusk/engine";
import type { CountryId, PublicState } from "@terminal-dusk/engine";
import { sixRegionMapConfig } from "@terminal-dusk/host/first-deck";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { button, treeOf } from "../../online/test/screenTree.ts";
import { baseFrame, map as fixtureMap, withMap } from "../test/mapFixture.ts";
import { DrawnMap } from "./DrawnMap.tsx";
import { leaderLines, neighbourPairs } from "./layout.ts";
import type { MapLayout } from "./layout.ts";
import { layoutFor } from "./layoutFor.ts";
import { SIX_REGION_LAYOUT } from "./sixRegionLayout.ts";

const fixturePub: PublicState = withMap(baseFrame()).view.public;
const sixMap = sixRegionMapConfig().setup.map!;
const era = sixMap.battlegrounds[0]!.era;
const sixPub: PublicState = {
  ...fixturePub,
  map: sixMap,
  era,
  influence: [
    { country: "cuba", lio: 0, sae: 3 },
    { country: "poland", lio: 4, sae: 1 },
    { country: "iran", lio: 1, sae: 1 },
  ],
};

function drawn(pub: PublicState, touched: CountryId[] = [], layout: MapLayout = layoutFor(pub.map!)) {
  const regions: string[] = [];
  const element = <DrawnMap pub={pub} layout={layout} touched={new Set(touched)} onRegion={(id) => regions.push(id)} />;
  return { regions, tree: treeOf(element), html: renderToString(element) };
}

/** Each marker's html, by country id. */
function markersOf(html: string): Map<string, string> {
  const found = [...html.matchAll(/<li class="dm-marker" data-country="([^"]+)"[^>]*>.*?<\/li>/g)];
  return new Map(found.map((m) => [m[1]!, m[0]]));
}
const markerOf = (html: string, id: string): string => {
  const found = markersOf(html).get(id);
  if (found === undefined) throw new Error(`no marker for ${id}`);
  return found;
};
const touchedIn = (html: string): string[] =>
  [...markersOf(html)].filter(([, m]) => m.includes('data-touched="true"')).map(([id]) => id);

describe("the six-region map drawn", () => {
  const { html, tree } = drawn(sixPub);

  it("draws one marker per country, 42, each at its place in the layout", () => {
    expect(markersOf(html).size).toBe(42);
    const p = SIX_REGION_LAYOUT.countries.cuba!;
    expect(markerOf(html, "cuba")).toContain(`left:${p.x - 46}px;top:${p.y - 24}px`);
  });

  it("shades one area per region and puts a button named after the region over each, which zooms to it", () => {
    expect([...html.matchAll(/<rect class="dm-area" data-region="([^"]+)"/g)].map((m) => m[1])).toEqual(
      sixMap.regions.map((r) => r.id),
    );
    expect(tree.buttons.map((b) => b.text)).toEqual(sixMap.regions.map((r) => r.name));
    const { tree: pressed, regions } = drawn(sixPub);
    button(pressed, "Europe").press();
    button(pressed, "The Americas").press();
    expect(regions).toEqual(["europe", "americas"]);
  });

  it("draws a line for each pair of neighbours once, and from each home box to its listed countries", () => {
    expect(html.match(/<line class="dm-link"/g)).toHaveLength(neighbourPairs(sixMap).length);
    for (const side of ["lio", "sae"] as const) {
      const lines = html.match(new RegExp(`<line class="dm-home-link" data-home="${side}"`, "g"));
      expect(lines).toHaveLength(sixMap.homeBox[side].length);
    }
    expect(html).toMatch(/<svg class="dm-lines" aria-hidden="true"/);
  });

  it("shows both home boxes", () => {
    expect(
      [...html.matchAll(/<li class="dm-home" data-home="(lio|sae)"[^>]*>([^<]+)<\/li>/g)].map((m) => m[2]),
    ).toEqual(["LIO home", "SAE home"]);
  });

  it("shows each country's short name, both sides' influence and stability, with the full name for a reader", () => {
    expect(markerOf(html, "cuba")).toMatch(
      /class="dm-name"[^>]*>Cuba<.*class="dm-lio"[^>]*>0<.*class="dm-sae"[^>]*>3</,
    );
    expect(markerOf(html, "saudi-arabia")).toContain(">S. Arabia<");
    expect(markerOf(html, "saudi-arabia")).toContain('title="Saudi Arabia"');
    const iran = sixMap.countries.find((c) => c.id === "iran")!;
    expect(markerOf(html, "iran")).toContain(`class="dm-stab"`);
    expect(markerOf(html, "iran")).toMatch(new RegExp(`class="dm-stab"[^>]*>${iran.stability}<`));
    expect(markerOf(html, "iran")).toContain(`Iran: LIO 1, SAE 1, stability ${iran.stability}`);
    // A country with no influence entry counts 0 for both sides.
    expect(markerOf(html, "japan")).toMatch(/class="dm-lio"[^>]*>0<.*class="dm-sae"[^>]*>0</);
  });

  it("colours each marker by its controller, as the engine's controller says", () => {
    expect(markerOf(html, "poland")).toContain('data-control="lio"');
    expect(markerOf(html, "cuba")).toContain('data-control="sae"');
    for (const c of sixMap.countries) {
      expect(markerOf(html, c.id)).toContain(`data-control="${controller(sixPub, c.id) ?? "none"}"`);
    }
  });

  it("marks exactly this era's battlegrounds", () => {
    const marked = [...markersOf(html)].filter(([, m]) => m.includes('data-battleground="true"')).map(([id]) => id);
    expect(marked).toEqual(sixMap.countries.filter((c) => isBattleground(sixPub, c.id)).map((c) => c.id));
    expect(marked.length).toBeGreaterThan(0);
    for (const id of marked) expect(markerOf(html, id)).toContain(", battleground");
  });
});

describe("the region standings chips (L8, #488)", () => {
  it("draws a chip for each of the six regions, and none on a map without scoring", () => {
    const chips = (html: string): string[] =>
      [...html.matchAll(/<li class="dm-chip" data-region="([^"]+)"/g)].map((m) => m[1]!);
    expect(chips(drawn(sixPub).html)).toEqual(sixMap.regions.map((r) => r.id));
    expect(chips(drawn(fixturePub).html)).toEqual([]);
  });
});

describe("the highlight on the countries the latest frame touched", () => {
  it("marks exactly the touched countries, and none when nothing was touched", () => {
    expect(touchedIn(drawn(sixPub, ["iran", "poland"]).html)).toEqual(["poland", "iran"]);
    expect(touchedIn(drawn(sixPub).html)).toEqual([]);
  });
  it("gives each touched country the pulse's beat, so the pulse starts again for a new move (L9, #489)", () => {
    const layout = layoutFor(sixPub.map!);
    const pulsing = (beat: 0 | 1): string[] => {
      const html = renderToString(
        <DrawnMap pub={sixPub} layout={layout} touched={new Set(["iran"])} beat={beat} onRegion={() => {}} />,
      );
      return [...markersOf(html)].filter(([, m]) => m.includes(`data-pulse="${beat}"`)).map(([id]) => id);
    };
    expect(pulsing(0)).toEqual(["iran"]);
    expect(pulsing(1)).toEqual(["iran"]);
    // An untouched country has no beat, so its marker does not redraw when the beat flips.
    expect(markerOf(drawn(sixPub, ["iran"]).html, "poland")).not.toContain("data-pulse");
  });
});

describe("closed regions", () => {
  it("are greyed, area and button, from the engine's closed regions; open ones are not", () => {
    const first = sixMap.closingOrder[0]!;
    const { html, tree } = drawn({ ...sixPub, escalation: 3 });
    const closed = [...html.matchAll(/<rect class="dm-area" data-region="([^"]+)" data-closed="true"/g)].map(
      (m) => m[1],
    );
    expect(closed).toEqual([first]);
    const name = sixMap.regions.find((r) => r.id === first)!.name;
    expect(tree.buttons.map((b) => b.text)).toContain(`${name} (closed)`);
    expect(drawn({ ...sixPub, escalation: 2 }).html).not.toContain('data-closed="true"');
  });
});

describe("any other map", () => {
  it("is drawn from its automatic layout: every country a marker, every region an area and a button", () => {
    const { html, tree } = drawn(fixturePub);
    expect([...markersOf(html).keys()]).toEqual(fixtureMap.countries.map((c) => c.id));
    expect(tree.buttons.map((b) => b.text)).toEqual(["Eastern Reach", "Western Shore"]);
    expect(markerOf(html, "w1")).toContain('data-control="lio"');
    expect(markerOf(html, "w1")).toMatch(/class="dm-lio"[^>]*>3<.*class="dm-sae"[^>]*>0</);
  });

  it("sizes its drawing to the layout, inside a map area that holds the wrapper", () => {
    const { html } = drawn(fixturePub);
    const { w, h } = layoutFor(fixtureMap).size;
    expect(html).toMatch(new RegExp(`^<div class="dm-view"><div class="dm-world" style="width:${w}px;height:${h}px"`));
  });
});

/** The six-region layout with stand-in art: a square shape per country and one border line. */
const withArt: MapLayout = {
  ...SIX_REGION_LAYOUT,
  art: {
    picture: "/world.webp",
    credit: "Picture credit",
    shapes: Object.fromEntries(sixMap.countries.map((c, i) => [c.id, `M${i} 0L${i + 1} 0L${i + 1} 1Z`])),
    borders: "M0 0L5 5",
  },
};

describe("the real-geography map (L3, #479)", () => {
  const { html } = drawn(sixPub, [], withArt);

  it("draws the picture first, at the drawing's size, hidden from readers and not draggable", () => {
    const { w, h } = withArt.size;
    expect(html).toMatch(
      new RegExp(
        `<div class="dm-world" data-art="true"[^>]*><img class="dm-picture" src="/world.webp" alt="" draggable="false" width="${w}" height="${h}"/>`,
      ),
    );
  });

  it("tints each region's countries in the region's tone, greyed when the region is closed", () => {
    const tints = [...html.matchAll(/<path class="dm-tint" data-region="([^"]+)"[^>]*d="([^"]+)"/g)];
    expect(tints.map((m) => m[1])).toEqual(sixMap.regions.map((r) => r.id));
    const europe = tints.find((m) => m[1] === "europe")![2]!;
    for (const c of sixMap.countries.filter((c) => c.region === "europe"))
      expect(europe).toContain(withArt.art!.shapes[c.id]!);
    const first = sixMap.closingOrder[0]!;
    const closed = drawn({ ...sixPub, escalation: 3 }, [], withArt).html;
    expect(
      [...closed.matchAll(/<path class="dm-tint" data-region="([^"]+)" data-closed="true"/g)].map((m) => m[1]),
    ).toEqual([first]);
  });

  it("draws the borders over the tints", () => {
    expect(html).toMatch(/<path class="dm-tint".*<path class="dm-borders" d="M0 0L5 5"/);
  });

  it("draws a leader line and a dot at the true place for each marker away from its country", () => {
    const leaders = leaderLines(withArt);
    const drawnLeaders = [
      ...html.matchAll(/<line class="dm-leader" data-country="([^"]+)" x1="(\d+)" y1="(\d+)" x2="(\d+)" y2="(\d+)"/g),
    ];
    expect(drawnLeaders.map((m) => m[1])).toEqual(leaders.map((l) => l.country));
    for (const [m, l] of drawnLeaders.map((m, i) => [m, leaders[i]!] as const))
      expect(m.slice(2).map(Number)).toEqual([l.from.x, l.from.y, l.to.x, l.to.y]);
    expect(html.match(/<circle class="dm-place"/g)).toHaveLength(leaders.length);
  });

  it("draws no picture, tints, borders or leader lines for a layout without art", () => {
    const plain = drawn(fixturePub).html;
    for (const part of ["dm-picture", "dm-tint", "dm-borders", "dm-leader", "dm-place", "data-art"])
      expect(plain).not.toContain(part);
  });
});
