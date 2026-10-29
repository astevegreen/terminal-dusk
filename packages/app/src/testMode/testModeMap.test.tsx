// Test mode plays on R14's test map (issue #366): the first frame carries the map and influence, and the screen
// draws the map's badges for LIO, SAE and the spectator, each from that viewer's own frame.
import type { Viewer } from "@terminal-dusk/engine";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ZoomableMap } from "../game/ZoomableMap.tsx";
import { byCodeUnit } from "../test/order.ts";
import { TestModeView } from "./TestModeScreen.tsx";
import { fixtureConfig, testModeConfig } from "./fixture.ts";
import { createTestSession } from "./session.ts";

const VIEWERS: readonly Viewer[] = ["lio", "sae", "spectator"];

describe("the test mode game on the test map", () => {
  it("has the map and the starting influence in its first frame's public state", () => {
    const pub = createTestSession(() => 0).getSnapshot().frame?.view.public;
    expect(pub?.map?.countries).toHaveLength(12);
    expect(pub?.map?.regions.length).toBeGreaterThan(0);
    expect(pub?.influence?.length).toBeGreaterThan(0);
  });
  it("draws the map's 12 country badges for LIO, SAE and the spectator, from each viewer's own frame", () => {
    for (const viewer of VIEWERS) {
      const session = createTestSession(() => 0);
      session.setViewer(viewer);
      const { frame } = session.getSnapshot();
      expect(frame?.viewer).toBe(viewer);
      const out = renderToString(<TestModeView snapshot={session.getSnapshot()} session={session} />);
      const ids = frame?.view.public.map?.countries.map((c) => c.id) ?? [];
      // The screen shows the drawn map first (L2, #465), a marker per country...
      const markers = [...out.matchAll(/<li class="dm-marker" data-country="([^"]+)"/g)].map((m) => m[1] ?? "");
      expect([...markers].sort(byCodeUnit)).toEqual([...ids].sort(byCodeUnit));
      expect(markers).toHaveLength(12);
      // ...and its List, behind the Map/List toggle, the badges, from the same viewer's frame.
      const list = renderToString(<ZoomableMap pub={frame!.view.public} startMode="list" />);
      const badges = [...list.matchAll(/<li class="map-badge" data-country="([^"]+)"/g)].map((m) => m[1] ?? "");
      expect([...badges].sort(byCodeUnit)).toEqual([...ids].sort(byCodeUnit));
      expect(badges).toHaveLength(12);
      expect(out).not.toContain("No map in this game");
    }
  });
  it("leaves the fixture config the vs-AI fixture game uses without a map, and gives each start a fresh map", () => {
    expect(fixtureConfig.setup.map).toBeUndefined();
    expect(testModeConfig().setup.map).not.toBe(testModeConfig().setup.map);
    expect(testModeConfig().setup.hands).toEqual(fixtureConfig.setup.hands);
  });
});
