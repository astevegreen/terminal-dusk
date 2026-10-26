// The map zoomed out (issue #364): badges per country, grouped by region, net influence, controller colour.
import { controller } from "@terminal-dusk/engine";
import type { Country, GameMap, InfluenceEntry } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cardName, cardQuestion } from "../testMode/fixture.ts";
import { createTestSession } from "../testMode/session.ts";
import { GameScreen } from "./GameScreen.tsx";

const country = (id: string, name: string, region: string, stability: number): Country => ({
  id,
  name,
  region,
  stability,
  battleground: false,
  neighbours: [],
});

// Two regions, listed East first, while the countries' list starts with a West one.
const map: GameMap = {
  regions: [
    { id: "east", name: "Eastern Reach" },
    { id: "west", name: "Western Shore" },
  ],
  countries: [
    country("w1", "Alderland", "west", 2),
    country("e1", "Birchmark", "east", 1),
    country("w2", "Cedaria", "west", 3),
    country("e2", "Dunmoor", "east", 2),
    country("w3", "Elmhaven", "west", 2),
  ],
  homeBox: { lio: ["w1"], sae: ["e1"] },
  // Escalation is 0 below, so no region is closed and the Map area never reads this.
  closingOrder: [],
};

// In another order than the map's, and with no entry for Dunmoor (e2).
const influence: InfluenceEntry[] = [
  { country: "w3", lio: 1, sae: 1 },
  { country: "w2", lio: 2, sae: 1 },
  { country: "e1", lio: 1, sae: 2 },
  { country: "w1", lio: 3, sae: 0 },
];

const baseFrame = (): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer("lio");
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame;
};

const withMap = (frame: Frame): Frame => ({
  ...frame,
  view: { ...frame.view, public: { ...frame.view.public, map, influence, escalation: 0 } },
});

const withoutMap = (frame: Frame): Frame => {
  const pub = { ...frame.view.public };
  delete pub.map;
  delete pub.influence;
  delete pub.escalation;
  return { ...frame, view: { ...frame.view, public: pub } };
};

const render = (frame: Frame): string =>
  renderToString(<GameScreen frame={frame} log={[]} era={null} label={cardName} question={cardQuestion} />);

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
  const out = mapAreaOf(render(withMap(baseFrame())));

  it("shows one badge per country in the map's order, grouped under each region's name in the map's region order", () => {
    const regions = [...out.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
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
    expect(out).toContain('<section aria-label="Map" data-testid="map-area" class="game-map" tabindex="0">');
  });
});

describe("the Map area with no map in the frame", () => {
  const frame = withoutMap(baseFrame());
  it('shows "No map in this game" and nothing else changes on the screen', () => {
    const out = render(frame);
    expect(mapAreaOf(out)).toMatch(/tabindex="0"><p>No map in this game<\/p><\/section>$/);
    const withMapOut = render(withMap(frame));
    const rest = (html: string): string => html.replace(mapAreaOf(html), "");
    expect(rest(out)).toBe(rest(withMapOut));
  });
});
