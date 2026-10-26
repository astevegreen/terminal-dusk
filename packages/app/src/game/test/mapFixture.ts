// Test helper: a hand-written two-region map, its influence, and test-mode frames with and without it.
import type { Country, GameMap, InfluenceEntry } from "@terminal-dusk/engine";
import type { Frame } from "@terminal-dusk/host";
import { createTestSession } from "../../testMode/session.ts";

const country = (id: string, name: string, region: string, stability: number): Country => ({
  id,
  name,
  region,
  stability,
  battleground: false,
  neighbours: [],
});

// Two regions, listed East first, while the countries' list starts with a West one.
export const map: GameMap = {
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
export const influence: InfluenceEntry[] = [
  { country: "w3", lio: 1, sae: 1 },
  { country: "w2", lio: 2, sae: 1 },
  { country: "e1", lio: 1, sae: 2 },
  { country: "w1", lio: 3, sae: 0 },
];

export const baseFrame = (): Frame => {
  const session = createTestSession(() => 0);
  session.setViewer("lio");
  const frame = session.getSnapshot().frame;
  if (!frame) throw new Error("no frame");
  return frame;
};

export const withMap = (frame: Frame, entries: InfluenceEntry[] = influence): Frame => ({
  ...frame,
  view: { ...frame.view, public: { ...frame.view.public, map, influence: entries, escalation: 0 } },
});

export const withoutMap = (frame: Frame): Frame => {
  const pub = { ...frame.view.public };
  delete pub.map;
  delete pub.influence;
  delete pub.escalation;
  return { ...frame, view: { ...frame.view, public: pub } };
};
