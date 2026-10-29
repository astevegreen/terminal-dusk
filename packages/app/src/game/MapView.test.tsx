// The map zoomed out (issue #364): badges per country, grouped by region, net influence, controller colour.
import { controller } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardAffiliation, cardName, cardQuestion } from "../testMode/fixture.ts";
import { GameScreen } from "./GameScreen.tsx";
import { baseFrame, map, withMap, withoutMap } from "./test/mapFixture.ts";
import { ZoomableMap } from "./ZoomableMap.tsx";

const render = (frame: Frame): string =>
  renderToString(
    <GameScreen
      frame={frame}
      log={[]}
      era={null}
      label={cardName}
      question={cardQuestion}
      affiliation={cardAffiliation}
    />,
  );

/** The Map area's html alone. */
const mapAreaOf = (out: string): string => {
  const match = /<section aria-label="Map"[^>]*>.*?<\/section>/.exec(out);
  if (!match) throw new Error("no map area");
  return match[0];
};

const badgeOf = (out: string, id: string): string => {
  const match = new RegExp(`<li[^>]*data-country="${id}"[^>]*>.*?</li>`).exec(out);
  if (!match) throw new Error(`no badge for ${id}`);
  return match[0];
};

describe("the Map area with a map in the frame", () => {
  // The badges are the Map area's List since the drawn map (L2, #465): drawn here as its List.
  const out = renderToString(<ZoomableMap pub={withMap(baseFrame()).view.public} startMode="list" />);
  const area = mapAreaOf(render(withMap(baseFrame())));

  it("holds the map's Map/List toggle, with the drawn map shown first", () => {
    expect(area).toContain('role="toolbar" aria-label="Map view"');
    expect(area).toContain('class="dm-view"');
    expect(area.match(/class="dm-marker"/g)).toHaveLength(map.countries.length);
  });

  it("shows one badge per country in the map's order, grouped under each region's name in the map's region order", () => {
    // Each region's name is a button inside its heading (issue #365), which zooms into the region.
    const regions = [...out.matchAll(/<h3[^>]*><button[^>]*>([^<]+)<\/button><\/h3>/g)].map((m) => m[1]);
    expect(regions).toEqual(["Eastern Reach", "Western Shore"]);
    const groups = [...out.matchAll(/data-region="([^"]+)".*?<\/ul>/g)].map((m) => ({
      region: m[1],
      countries: [...m[0].matchAll(/data-country="([^"]+)"/g)].map((c) => c[1]),
    }));
    expect(groups).toEqual([
      { region: "east", countries: ["e1", "e2"] },
      { region: "west", countries: ["w1", "w2", "w3"] },
    ]);
    expect(out.match(/data-country=/g)).toHaveLength(map.countries.length);
  });

  it("shows each country's name and its net influence, the larger side's minus the smaller's, 0 when equal", () => {
    expect(badgeOf(out, "w1")).toMatch(/>Alderland<.*>3</);
    expect(badgeOf(out, "e1")).toMatch(/>Birchmark<.*>1</);
    expect(badgeOf(out, "w2")).toMatch(/>Cedaria<.*>1</);
    expect(badgeOf(out, "w3")).toMatch(/>Elmhaven<.*>0</);
  });

  it("looks influence up by country id, in any order, and counts a country with no entry as 0 for both sides", () => {
    expect(badgeOf(out, "e2")).toMatch(/>Dunmoor<.*>0</);
    expect(badgeOf(out, "e2")).toContain('data-control="none"');
  });

  it("marks a LIO-controlled, a SAE-controlled and an uncontrolled country, as the engine's controller says", () => {
    expect(badgeOf(out, "w1")).toContain('data-control="lio"');
    expect(badgeOf(out, "e1")).toContain('data-control="sae"');
    // Uncontrolled with unequal influence on both sides (2 and 1 at stability 3): the difference, neutral colour.
    expect(badgeOf(out, "w2")).toContain('data-control="none"');
    const pub = withMap(baseFrame()).view.public;
    for (const c of map.countries) {
      expect(badgeOf(out, c.id)).toContain(`data-control="${controller(pub, c.id) ?? "none"}"`);
    }
  });

  it("lets the keyboard reach the Map area, which scrolls inside itself", () => {
    expect(area).toContain('<section aria-label="Map" data-testid="map-area" class="game-map" tabindex="0">');
  });
});

describe("the Map area with no map in the frame", () => {
  const frame = withoutMap(baseFrame());
  it('shows "No map in this game" and nothing else changes on the screen but the no-map mark (#412)', () => {
    const out = render(frame);
    expect(mapAreaOf(out)).toMatch(/tabindex="0"><p>No map in this game<\/p><\/section>$/);
    const withMapOut = render(withMap(frame));
    const rest = (html: string): string => html.replace(mapAreaOf(html), "");
    expect(rest(out)).toBe(rest(withMapOut).replace('<div class="game">', '<div class="game game-no-map">'));
  });
});
