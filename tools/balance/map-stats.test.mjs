// The map numbers from a hand-made public view and events: influence, control through the engine's controller,
// points per action from the public events, and the averages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapNumbers, mapSummary } from "./map-stats.mjs";

const country = (id, stability) => ({ id, name: id, region: "r", stability, battleground: false, neighbours: [] });
// a: LIO 3 against 0 at stability 2 (LIO controls); b: SAE 2 against 1 at stability 1 (SAE controls);
// c: LIO 1 against 1 at stability 1 (nobody).
const PUBLIC = {
  map: { regions: [], countries: [country("a", 2), country("b", 1), country("c", 1)] },
  influence: [
    { country: "a", lio: 3, sae: 0 },
    { country: "b", lio: 1, sae: 2 },
    { country: "c", lio: 1, sae: 1 },
  ],
};
const EVENTS = [
  { kind: "pointsSpent", visibility: "public", side: "lio", amount: 3 },
  { kind: "influencePlaced", visibility: "public", side: "lio", country: "a", cost: 1 },
  { kind: "influencePlaced", visibility: "public", side: "lio", country: "b", cost: 2 },
  { kind: "intervened", visibility: "public", side: "sae", country: "c", points: 4, stability: 1 },
  { kind: "realigned", visibility: "public", side: "sae", country: "a", loser: null, removed: 0 },
  { kind: "realigned", visibility: "public", side: "sae", country: "a", loser: "lio", removed: 1 },
  { kind: "cardPlayed", visibility: "public", side: "lio" },
];

test("one game's map numbers: influence, countries controlled and points per action, per side", () => {
  assert.deepEqual(mapSummary(PUBLIC, EVENTS), {
    lio: { influence: 5, controlled: 1, spent: { place: 3, intervene: 0, realign: 0 } },
    sae: { influence: 3, controlled: 1, spent: { place: 0, intervene: 4, realign: 2 } },
  });
});

test("a game with no map has no map numbers", () => {
  assert.equal(mapSummary({}, EVENTS), null);
});

test("the report's map numbers are averages per game, rounded to 2 places; none when no game has a map", () => {
  const one = { map: mapSummary(PUBLIC, EVENTS) };
  const empty = { map: mapSummary(PUBLIC, []) };
  const avg = mapNumbers([one, empty, empty]);
  assert.equal(avg.lio.influence, 5);
  assert.equal(avg.lio.spent.place, 1);
  assert.equal(avg.sae.spent.intervene, 1.33);
  assert.equal(avg.sae.spent.realign, 0.67);
  assert.equal(mapNumbers([{ map: null }, { map: null }]), undefined);
  assert.equal(mapNumbers([]), undefined);
});
